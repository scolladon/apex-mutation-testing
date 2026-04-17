import { TestResult } from '@salesforce/apex-node'
import { Connection, Messages } from '@salesforce/core'
import { Progress, Spinner } from '@salesforce/sf-plugins-core'
import { ApexClassRepository } from '../../../src/adapter/apexClassRepository.js'
import { ApexTestRunner } from '../../../src/adapter/apexTestRunner.js'
import { SObjectDescribeRepository } from '../../../src/adapter/sObjectDescribeRepository.js'
import { MutantGenerator } from '../../../src/service/mutantGenerator.js'
import {
  LineOffsetIndex,
  MutationTestingService,
} from '../../../src/service/mutationTestingService.js'
import {
  formatDuration,
  timeExecution,
} from '../../../src/service/timeUtils.js'
import { TypeDiscoverer } from '../../../src/service/typeDiscoverer.js'
import {
  ApexClassTypeMatcher,
  SObjectTypeMatcher,
} from '../../../src/service/typeMatcher.js'
import { ApexMutation } from '../../../src/type/ApexMutation.js'
import { ApexMutationParameter } from '../../../src/type/ApexMutationParameter.js'
import { ApexMutationTestResult } from '../../../src/type/ApexMutationTestResult.js'
import { MetadataComponentDependency } from '../../../src/type/MetadataComponentDependency.js'

vi.mock('../../../src/adapter/apexClassRepository.js')
vi.mock('../../../src/adapter/apexTestRunner.js')
vi.mock('../../../src/adapter/sObjectDescribeRepository.js')
vi.mock('../../../src/service/mutantGenerator.js')
vi.mock('../../../src/service/typeDiscoverer.js')
vi.mock('../../../src/service/timeUtils.js')
vi.mock('../../../src/service/typeMatcher.js')

// Hoisted so both the mock registration (inside beforeEach) and the
// toHaveBeenCalledWith identity assertions can share the same references.
// Perf-3 requires MutationTestingService to pass the very same tree/tokenStream
// produced by analyzeFull into MutantGenerator.compute's preParsed arg — this
// identity is the test that catches a regression where someone re-parses.
const mockTypeRegistry = {}
const mockAnalyzeFullResult = {
  typeRegistry: mockTypeRegistry,
  // Inert stubs — the service never calls methods on these; they exist to
  // satisfy the interface shape when unit tests mock MutantGenerator.compute.
  tree: {} as never,
  tokenStream: {} as never,
}

describe('MutationTestingService', () => {
  let sut: MutationTestingService
  let progress: Progress
  let spinner: Spinner
  let connection: Connection
  let messagesMock: Messages<string>

  const mockApexClass = {
    Id: '123',
    Name: 'TestClass',
    Body: 'class TestClass { public static Integer getValue() { return 42; } }',
  }

  const mockTestClass = {
    Id: '456',
    Name: 'TestClassTest',
    Body: '@IsTest class TestClassTest { @IsTest static void test() {} }',
  }

  const mockMutation = {
    mutationName: 'TestMutation',
    replacement: '0',
    target: {
      startToken: {
        line: 1,
        charPositionInLine: 50,
        tokenIndex: 5,
        startIndex: 60, // Position of "42" in the string
        stopIndex: 61, // End position of "42" (inclusive)
      },
      endToken: {
        line: 1,
        charPositionInLine: 51,
        tokenIndex: 5,
        startIndex: 60, // Position of "42" in the string
        stopIndex: 61, // End position of "42" (inclusive)
      },
      text: '42',
    },
  }

  beforeEach(() => {
    progress = {
      start: vi.fn(),
      update: vi.fn(),
      finish: vi.fn(),
    } as unknown as Progress

    spinner = {
      start: vi.fn(),
      stop: vi.fn(),
    } as unknown as Spinner

    connection = {} as Connection

    messagesMock = {
      getMessage: vi.fn((key: string, args?: string[]) => {
        const templates: Record<string, string> = {
          'error.noCoverage': `No test coverage found for '${args?.[0]}'. Ensure '${args?.[1]}' tests exercise the code you want to mutation test.`,
          'error.noMutations': `No mutations could be generated for '${args?.[0]}'. ${args?.[1]} line(s) covered but no mutable patterns found.`,
          'error.compilabilityCheckFailed': `The Apex class '${args?.[0]}' does not compile on the target org. Fix compilation errors before running mutation testing.\nError: ${args?.[1]}`,
          'info.timeEstimate': `Estimated time: ${args?.[0]}`,
          'info.timeEstimateBreakdown': `Deploy: ${args?.[0]}/mutant | Test: ${args?.[1]}/mutant | Mutants: ${args?.[2]}`,
        }
        return templates[key] || key
      }),
    } as unknown as Messages<string>

    vi.mocked(SObjectDescribeRepository).mockImplementation(
      class {
        describe = vi.fn().mockResolvedValue(undefined)
      }
    )

    vi.mocked(TypeDiscoverer).mockImplementation(
      class {
        withMatcher = vi.fn().mockReturnThis()
        analyze = vi.fn().mockResolvedValue(mockTypeRegistry)
        analyzeFull = vi.fn().mockResolvedValue(mockAnalyzeFullResult)
      }
    )

    vi.mocked(timeExecution).mockImplementation(
      async (fn: () => Promise<unknown>) => {
        const result = await fn()
        return { result, durationMs: 5000 }
      }
    )
    vi.mocked(formatDuration).mockReturnValue('~5s')

    sut = new MutationTestingService(
      progress,
      spinner,
      connection,
      {
        apexClassName: 'TestClass',
        apexTestClassName: 'TestClassTest',
      } as ApexMutationParameter,
      messagesMock
    )
  })

  describe('Given a mutation testing service', () => {
    describe('When test class fails', () => {
      it('then should throw an error', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Failed',
              passing: 0,
              failing: 1,
              testsRan: 1,
              testMethodsPerLine: new Map(),
            })
          }
        )

        // Act & Assert
        await expect(sut.process()).rejects.toThrow(
          'Original tests failed! Cannot proceed with mutation testing.'
        )
      })
    })

    describe('When test class does not have any test methods', () => {
      it('then should throw an error', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 0,
              failing: 0,
              testsRan: 0,
              testMethodsPerLine: new Map(),
            })
          }
        )

        // Act & Assert
        await expect(sut.process()).rejects.toThrow(
          'No tests were executed! Check that:'
        )
      })
    })

    describe('When processing mutations', () => {
      const testCases = [
        {
          description: 'when test is failing',
          testResult: {
            summary: {
              outcome: 'Failed',
              passing: 0,
              failing: 1,
              testsRan: 1,
            },
          } as TestResult,
          expectedStatus: 'Killed',
          error: null,
          updateError: null,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'Killed',
              replacement: '0',
              original: '42',
            }),
          ],
        },
        {
          description: 'when test is passing',
          testResult: {
            summary: {
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
            },
          } as TestResult,
          expectedStatus: 'Survived',
          error: null,
          updateError: null,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'Survived',
              replacement: '0',
              original: '42',
            }),
          ],
        },
        {
          description: 'when test runner throws runtime exception',
          testResult: null,
          expectedStatus: 'RuntimeError',
          error: new Error(
            'Unable to refresh session due to: Error authenticating with the refresh token due to: expired access/refresh token'
          ),
          updateError: null,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'RuntimeError',
              statusReason:
                'Unable to refresh session due to: Error authenticating with the refresh token due to: expired access/refresh token',
              replacement: '0',
              original: '42',
            }),
          ],
        },
        {
          description: 'when test runner throws governor limit exception',
          testResult: null,
          expectedStatus: 'Killed',
          error: new Error(
            'System.LimitException: LIMIT_USAGE_FOR_NS : Too many SOQL queries'
          ),
          updateError: null,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'Killed',
              replacement: '0',
              original: '42',
            }),
          ],
        },
        {
          description: 'when test runner throws non-Error object',
          testResult: null,
          expectedStatus: 'RuntimeError',
          error: 'plain string error',
          updateError: null,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'RuntimeError',
              statusReason: 'plain string error',
              replacement: '0',
              original: '42',
            }),
          ],
        },
        {
          description: 'when deployment fails with compile error',
          testResult: {
            summary: {
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
            },
          } as TestResult,
          expectedStatus: 'CompileError',
          error: null,
          updateError: new Error(
            'Deployment failed:\n[TestClass.cls:1:50] Invalid syntax'
          ),
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'CompileError',
              statusReason:
                'Deployment failed:\n[TestClass.cls:1:50] Invalid syntax',
              replacement: '0',
              original: '42',
            }),
          ],
        },
      ]

      it.each(testCases)('should handle $description', async ({
        testResult,
        expectedMutants,
        error,
        updateError,
      }) => {
        // Arrange
        let updateCallCount = 0
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockImplementation(() => {
              updateCallCount++
              // Calls 1-2: verify compile passes; call 3: mutation deploy may
              // fail (updateError); call 4+ (rollback) must succeed so the
              // rollback-failure propagation isn't what the test is asserting.
              if (updateCallCount <= 2) return Promise.resolve({})
              if (updateCallCount === 3 && updateError)
                return Promise.reject(updateError)
              return Promise.resolve({})
            })
            getApexClassDependencies = vi.fn().mockResolvedValue([
              {
                Id: 'dep1',
                RefMetadataComponentType: 'ApexClass',
                RefMetadataComponentName: 'TestDep',
              },
              {
                Id: 'dep2',
                RefMetadataComponentType: 'StandardEntity',
                RefMetadataComponentName: 'Account',
              },
              {
                Id: 'dep3',
                RefMetadataComponentType: 'CustomObject',
                RefMetadataComponentName: 'Custom__c',
              },
            ] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockImplementation(() => {
              if (error) {
                return Promise.reject(error)
              }
              return Promise.resolve(testResult)
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        const result = await sut.process()

        // Assert
        expect(result).toEqual({
          sourceFile: 'TestClass',
          sourceFileContent: mockApexClass.Body,
          testFile: 'TestClassTest',
          mutants: expectedMutants,
        })
        expect(progress.start).toHaveBeenCalled()
        expect(progress.finish).toHaveBeenCalled()
      })

      // Rollback-failure variant: each error classification path is also
      // exercised with a failing rollback so we catch a regression where the
      // service swallows rollback errors or leaks partial results on throw.
      // See Test-I1: the happy-path parametric test above allowed call 4+ to
      // always resolve, which hid this surface.
      it.each(
        testCases
      )('should re-throw rollback failure while still classifying the mutant ($description)', async ({
        testResult,
        error,
        updateError,
      }) => {
        // Arrange
        let updateCallCount = 0
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockImplementation(() => {
              updateCallCount++
              if (updateCallCount <= 2) return Promise.resolve({})
              if (updateCallCount === 3 && updateError)
                return Promise.reject(updateError)
              if (updateCallCount === 3) return Promise.resolve({})
              // Call 4 = rollback — always fails in this variant.
              return Promise.reject(new Error('rollback network down'))
            })
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi.fn().mockReturnValue({
              mutations: [mockMutation],
              tokenStream: {},
            })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockImplementation(() => {
              if (error) return Promise.reject(error)
              return Promise.resolve(testResult)
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act & Assert — rollback failure must propagate, never silently swallow
        await expect(sut.process()).rejects.toThrow(
          /Rollback of 'TestClass' failed/
        )
        // rollback was in fact attempted (call 4)
        expect(updateCallCount).toBe(4)
        // A warning spinner message precedes the throw
        expect(spinner.stop).toHaveBeenCalledWith(
          expect.stringContaining('Rollback FAILED')
        )
      })
    })

    describe('When dry-run is enabled', () => {
      it('then should return ApexMutationTestResult with Pending status without running mutation tests', async () => {
        // Arrange
        const mockUpdateFn = vi.fn().mockResolvedValue({})
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = mockUpdateFn
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn()
          }
        )
        const mockRunTestMethods = vi.fn()
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = mockRunTestMethods
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        const dryRunService = new MutationTestingService(
          progress,
          spinner,
          connection,
          {
            apexClassName: 'TestClass',
            apexTestClassName: 'TestClassTest',
            dryRun: true,
          } as ApexMutationParameter,
          messagesMock
        )

        // Act
        const result = await dryRunService.process()

        // Assert
        expect(result).toEqual({
          sourceFile: 'TestClass',
          sourceFileContent: mockApexClass.Body,
          testFile: 'TestClassTest',
          mutants: [
            {
              id: expect.stringContaining('TestClass-'),
              mutatorName: 'TestMutation',
              status: 'Pending',
              location: {
                start: { line: 1, column: 61 },
                end: { line: 1, column: 63 },
              },
              replacement: '0',
              original: '42',
            },
          ],
        })
        expect(mockUpdateFn).toHaveBeenCalledTimes(2)
        expect(mockRunTestMethods).not.toHaveBeenCalled()
        expect(progress.start).not.toHaveBeenCalled()
        expect(progress.finish).not.toHaveBeenCalled()
        expect(progress.update).not.toHaveBeenCalled()
        expect(spinner.start).toHaveBeenCalledWith(
          expect.stringContaining('Estimated time:'),
          undefined,
          expect.anything()
        )
        expect(spinner.stop).toHaveBeenCalledWith(
          expect.stringContaining('Deploy:')
        )
      })
    })

    describe('When no coverage exists on the class', () => {
      it('then should throw an error with helpful message', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map(), // Empty - no coverage
            })
          }
        )

        // Act & Assert
        await expect(sut.process()).rejects.toThrow(
          "No test coverage found for 'TestClass'. Ensure 'TestClassTest' tests exercise the code you want to mutation test."
        )
      })
    })

    describe('When coverage exists but no mutations are generated', () => {
      it('then should throw an error with helpful message', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [], tokenStream: {} }) // No mutations
            mutate = vi.fn()
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethod'])]]),
            })
          }
        )

        // Act & Assert
        await expect(sut.process()).rejects.toThrow(
          "No mutations could be generated for 'TestClass'. 1 line(s) covered but no mutable patterns found."
        )
      })
    })

    describe('When main class compilability check fails', () => {
      it('then should throw an error with compilability message', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi
              .fn()
              .mockRejectedValue(new Error('Deployment failed: compile error'))
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )

        // Act & Assert
        await expect(sut.process()).rejects.toThrow(
          "The Apex class 'TestClass' does not compile on the target org."
        )
      })
    })

    describe('When test class compilability check fails', () => {
      it('then should throw an error with compilability message', async () => {
        // Arrange
        let updateCallCount = 0
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockImplementation(() => {
              updateCallCount++
              if (updateCallCount === 1) return Promise.resolve({})
              return Promise.reject(
                new Error('Deployment failed: test class compile error')
              )
            })
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )

        // Act & Assert
        await expect(sut.process()).rejects.toThrow(
          "The Apex class 'TestClassTest' does not compile on the target org."
        )
      })
    })

    describe('When test class compilability check fails with non-Error', () => {
      it('then should throw an error with string error message', async () => {
        // Arrange
        let updateCallCount = 0
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockImplementation(() => {
              updateCallCount++
              if (updateCallCount === 1) return Promise.resolve({})
              return Promise.reject('plain string deploy error')
            })
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )

        // Act & Assert
        await expect(sut.process()).rejects.toThrow(
          "The Apex class 'TestClassTest' does not compile on the target org."
        )
      })
    })

    describe('When main class compilability check fails with non-Error', () => {
      it('then should throw an error with string error message', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockRejectedValue('plain string deploy error')
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )

        // Act & Assert
        await expect(sut.process()).rejects.toThrow(
          "The Apex class 'TestClass' does not compile on the target org."
        )
      })
    })

    describe('When time estimate is displayed', () => {
      it('then should show estimate via spinner', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert
        expect(spinner.start).toHaveBeenCalledWith(
          expect.stringContaining('Estimated time:'),
          undefined,
          { stdout: true }
        )
        expect(spinner.stop).toHaveBeenCalledWith(
          expect.stringContaining('Deploy:')
        )
      })
    })

    describe('When progress bar updates during mutation loop', () => {
      it('then should include remaining time in progress info', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert
        const updateCalls = vi.mocked(progress.update).mock.calls
        const lastUpdateCall = updateCalls[updateCalls.length - 1]
        expect(lastUpdateCall[1].info).toContain('Remaining:')
      })

      it('then should show remaining time in deploy and running updates after first mutation', async () => {
        // Arrange
        const secondMutation = { ...mockMutation, replacement: '1' }
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi.fn().mockReturnValue({
              mutations: [mockMutation, secondMutation],
              tokenStream: {},
            })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert
        const updateCalls = vi.mocked(progress.update).mock.calls
        const infos = updateCalls.map(
          (call: [number, { info: string }]) => call[1].info
        )
        expect(
          infos.some(
            (info: string) =>
              info.includes('Deploying "1"') && info.includes('Remaining:')
          )
        ).toBe(true)
        expect(
          infos.some(
            (info: string) =>
              info.includes('Running') &&
              info.includes('"1"') &&
              info.includes('Remaining:')
          )
        ).toBe(true)
      })
    })

    describe('When calculating mutation position with undefined indices', () => {
      it('Then should throw an error for undefined startIndex', () => {
        // Arrange
        const mutation = {
          mutationName: 'TestMutation',
          replacement: '0',
          target: {
            startToken: { startIndex: undefined },
            endToken: { stopIndex: 10 },
            text: '42',
          },
        }

        // Act & Assert
        expect(() =>
          sut['calculateMutationPosition'](
            mutation as unknown as ApexMutation,
            'source code'
          )
        ).toThrow('Failed to calculate position for mutation: TestMutation')
      })

      it('Then should throw an error for undefined stopIndex', () => {
        // Arrange
        const mutation = {
          mutationName: 'TestMutation',
          replacement: '0',
          target: {
            startToken: { startIndex: 0 },
            endToken: { stopIndex: undefined },
            text: '42',
          },
        }

        // Act & Assert
        expect(() =>
          sut['calculateMutationPosition'](
            mutation as unknown as ApexMutation,
            'source code'
          )
        ).toThrow('Failed to calculate position for mutation: TestMutation')
      })
    })

    describe('When extracting mutation original text with undefined indices', () => {
      it('Then should throw an error for undefined startIndex', () => {
        // Arrange
        sut['apexClassContent'] = 'class TestClass {}'
        const mutation = {
          mutationName: 'TestMutation',
          replacement: '0',
          target: {
            startToken: { startIndex: undefined },
            endToken: { stopIndex: 10 },
            text: '42',
          },
        }

        // Act & Assert
        expect(() =>
          sut['extractMutationOriginalText'](
            mutation as unknown as ApexMutation
          )
        ).toThrow('Failed to extract original text for mutation: TestMutation')
      })

      it('Then should throw an error for undefined stopIndex', () => {
        // Arrange
        sut['apexClassContent'] = 'class TestClass {}'
        const mutation = {
          mutationName: 'TestMutation',
          replacement: '0',
          target: {
            startToken: { startIndex: 0 },
            endToken: { stopIndex: undefined },
            text: '42',
          },
        }

        // Act & Assert
        expect(() =>
          sut['extractMutationOriginalText'](
            mutation as unknown as ApexMutation
          )
        ).toThrow('Failed to extract original text for mutation: TestMutation')
      })
    })

    describe('Given includeTestMethods with testMethodA, When processing, Then only testMethodA is used in testMethodsPerLine', () => {
      it('should only keep testMethodA in testMethodsPerLine', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        const mockComputeFn = vi
          .fn()
          .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = mockComputeFn
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        const mockRunTestMethods = vi.fn().mockResolvedValue({
          summary: { outcome: 'Failed', passing: 0, failing: 1, testsRan: 1 },
        })
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = mockRunTestMethods
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 2,
              testMethodsPerLine: new Map([
                [1, new Set(['testMethodA', 'testMethodB'])],
              ]),
            })
          }
        )

        const filteredSut = new MutationTestingService(
          progress,
          spinner,
          connection,
          {
            apexClassName: 'TestClass',
            apexTestClassName: 'TestClassTest',
            includeTestMethods: ['testMethodA'],
          } as ApexMutationParameter,
          messagesMock
        )

        // Act
        await filteredSut.process()

        // Assert
        expect(mockRunTestMethods).toHaveBeenCalledWith(
          'TestClassTest',
          new Set(['testMethodA'])
        )
      })
    })

    describe('Given excludeTestMethods with testMethodA, When processing with testMethodA and testMethodB covering line, Then testMethodA is excluded from testMethodsPerLine', () => {
      it('should exclude testMethodA from testMethodsPerLine', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        const mockComputeFn = vi
          .fn()
          .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = mockComputeFn
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        const mockRunTestMethods = vi.fn().mockResolvedValue({
          summary: { outcome: 'Failed', passing: 0, failing: 1, testsRan: 1 },
        })
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = mockRunTestMethods
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 2,
              testMethodsPerLine: new Map([
                [1, new Set(['testMethodA', 'testMethodB'])],
              ]),
            })
          }
        )

        const filteredSut = new MutationTestingService(
          progress,
          spinner,
          connection,
          {
            apexClassName: 'TestClass',
            apexTestClassName: 'TestClassTest',
            excludeTestMethods: ['testMethodA'],
          } as ApexMutationParameter,
          messagesMock
        )

        // Act
        await filteredSut.process()

        // Assert
        expect(mockRunTestMethods).toHaveBeenCalledWith(
          'TestClassTest',
          new Set(['testMethodB'])
        )
      })
    })

    describe('Given excludeTestMethods that removes all tests for a line, When processing, Then that line is removed from coveredLines', () => {
      it('should not generate mutations for lines with no remaining test methods', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        const mockComputeFn = vi
          .fn()
          .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = mockComputeFn
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([
                [1, new Set(['testMethodA'])],
                [2, new Set(['testMethodB'])],
              ]),
            })
          }
        )

        const filteredSut = new MutationTestingService(
          progress,
          spinner,
          connection,
          {
            apexClassName: 'TestClass',
            apexTestClassName: 'TestClassTest',
            excludeTestMethods: ['testMethodA'],
          } as ApexMutationParameter,
          messagesMock
        )

        // Act
        await filteredSut.process()

        // Assert
        expect(mockComputeFn).toHaveBeenCalledWith(
          mockApexClass.Body,
          new Set([2]),
          expect.anything(),
          undefined,
          [],
          undefined,
          expect.objectContaining({
            tree: mockAnalyzeFullResult.tree,
            tokenStream: mockAnalyzeFullResult.tokenStream,
          })
        )
      })
    })

    describe('Given includeMutators, When processing, Then MutantGenerator.compute receives mutator filter', () => {
      it('should pass mutator filter with include to compute', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        const mockComputeFn = vi
          .fn()
          .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = mockComputeFn
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        const filteredSut = new MutationTestingService(
          progress,
          spinner,
          connection,
          {
            apexClassName: 'TestClass',
            apexTestClassName: 'TestClassTest',
            includeMutators: ['ArithmeticOperator', 'BoundaryCondition'],
          } as ApexMutationParameter,
          messagesMock
        )

        // Act
        await filteredSut.process()

        // Assert
        expect(mockComputeFn).toHaveBeenCalledWith(
          mockApexClass.Body,
          new Set([1]),
          expect.anything(),
          { include: ['ArithmeticOperator', 'BoundaryCondition'] },
          [],
          undefined,
          expect.objectContaining({
            tree: mockAnalyzeFullResult.tree,
            tokenStream: mockAnalyzeFullResult.tokenStream,
          })
        )
      })
    })

    describe('Given excludeMutators, When processing, Then MutantGenerator.compute receives mutator filter with exclude', () => {
      it('should pass mutator filter with exclude to compute', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        const mockComputeFn = vi
          .fn()
          .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = mockComputeFn
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        const filteredSut = new MutationTestingService(
          progress,
          spinner,
          connection,
          {
            apexClassName: 'TestClass',
            apexTestClassName: 'TestClassTest',
            excludeMutators: ['ArithmeticOperator'],
          } as ApexMutationParameter,
          messagesMock
        )

        // Act
        await filteredSut.process()

        // Assert
        expect(mockComputeFn).toHaveBeenCalledWith(
          mockApexClass.Body,
          new Set([1]),
          expect.anything(),
          { exclude: ['ArithmeticOperator'] },
          [],
          undefined,
          expect.objectContaining({
            tree: mockAnalyzeFullResult.tree,
            tokenStream: mockAnalyzeFullResult.tokenStream,
          })
        )
      })
    })

    describe('When calculating mutation score', () => {
      const scoreTestCases = [
        {
          description: 'with kills',
          mutants: [
            { status: 'Killed' },
            { status: 'Survived' },
            { status: 'Killed' },
          ],
          expectedScore: 66.66666666666666,
        },
        {
          description: 'with no mutants',
          mutants: [],
          expectedScore: 0,
        },
        {
          description: 'with compile errors excluded from score',
          mutants: [
            { status: 'Killed' },
            { status: 'Survived' },
            { status: 'CompileError' },
          ],
          expectedScore: 50,
        },
        {
          description: 'with only compile errors',
          mutants: [{ status: 'CompileError' }, { status: 'CompileError' }],
          expectedScore: 0,
        },
        {
          description: 'with runtime errors counted as killed in score',
          mutants: [
            { status: 'Killed' },
            { status: 'Survived' },
            { status: 'RuntimeError' },
          ],
          expectedScore: 66.66666666666666,
        },
        {
          description: 'with only runtime errors',
          mutants: [{ status: 'RuntimeError' }, { status: 'RuntimeError' }],
          expectedScore: 100,
        },
        {
          description: 'with mixed compile and runtime errors',
          mutants: [
            { status: 'Killed' },
            { status: 'CompileError' },
            { status: 'RuntimeError' },
            { status: 'Survived' },
          ],
          expectedScore: 66.66666666666666,
        },
        {
          description: 'with only Pending mutants (all valid, none killed)',
          mutants: [{ status: 'Pending' }, { status: 'Pending' }],
          expectedScore: 0,
        },
        {
          description: 'with only NoCoverage mutants (all valid, none killed)',
          mutants: [{ status: 'NoCoverage' }, { status: 'NoCoverage' }],
          expectedScore: 0,
        },
        {
          description: 'with a single Survived mutant',
          mutants: [{ status: 'Survived' }],
          expectedScore: 0,
        },
        {
          description: 'with a single Killed mutant',
          mutants: [{ status: 'Killed' }],
          expectedScore: 100,
        },
      ]

      it.each(scoreTestCases)('should calculate correct score $description', ({
        mutants,
        expectedScore,
      }) => {
        // Arrange
        const mockResult = {
          sourceFile: 'TestClass',
          sourceFileContent: 'content',
          testFile: 'TestClassTest',
          mutants,
        } as ApexMutationTestResult

        // Act
        const score = sut.calculateScore(mockResult)

        // Assert
        expect(score).toBe(expectedScore)
      })
    })

    describe('When discoverTypes is called', () => {
      const buildFullProcessMocks = (
        dependencies: MetadataComponentDependency[]
      ) => {
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue(dependencies)
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )
        vi.mocked(ApexClassTypeMatcher).mockImplementation(
          class {
            withMatcher = vi.fn().mockReturnThis()
            matches = vi.fn().mockReturnValue(false)
            collect = vi.fn()
            collectedTypes = new Set<string>()
          }
        )
        vi.mocked(SObjectTypeMatcher).mockImplementation(
          class {
            withMatcher = vi.fn().mockReturnThis()
            matches = vi.fn().mockReturnValue(false)
            collect = vi.fn()
            collectedTypes = new Set<string>()
            populate = vi.fn().mockResolvedValue(undefined)
            getFieldType = vi.fn().mockReturnValue(undefined)
          }
        )
      }

      it('Given only ApexClass dependencies, When processing, Then ApexClassTypeMatcher is constructed with ApexClass names only', async () => {
        // Arrange
        const dependencies: MetadataComponentDependency[] = [
          {
            Id: 'dep1',
            RefMetadataComponentType: 'ApexClass',
            RefMetadataComponentName: 'MyHelper',
          },
          {
            Id: 'dep2',
            RefMetadataComponentType: 'StandardEntity',
            RefMetadataComponentName: 'Account',
          },
          {
            Id: 'dep3',
            RefMetadataComponentType: 'CustomObject',
            RefMetadataComponentName: 'Invoice__c',
          },
        ]
        buildFullProcessMocks(dependencies)

        // Act
        await sut.process()

        // Assert
        expect(vi.mocked(ApexClassTypeMatcher)).toHaveBeenCalledWith(
          new Set(['MyHelper'])
        )
      })

      it('Given only StandardEntity and CustomObject dependencies, When processing, Then SObjectTypeMatcher is constructed with sObject names only', async () => {
        // Arrange
        const dependencies: MetadataComponentDependency[] = [
          {
            Id: 'dep1',
            RefMetadataComponentType: 'ApexClass',
            RefMetadataComponentName: 'MyHelper',
          },
          {
            Id: 'dep2',
            RefMetadataComponentType: 'StandardEntity',
            RefMetadataComponentName: 'Account',
          },
          {
            Id: 'dep3',
            RefMetadataComponentType: 'CustomObject',
            RefMetadataComponentName: 'Invoice__c',
          },
        ]
        buildFullProcessMocks(dependencies)

        // Act
        await sut.process()

        // Assert
        expect(vi.mocked(SObjectTypeMatcher)).toHaveBeenCalledWith(
          new Set(['Account', 'Invoice__c']),
          expect.anything()
        )
      })

      it('Given no ApexClass dependencies, When processing, Then ApexClassTypeMatcher receives empty set', async () => {
        // Arrange
        const dependencies: MetadataComponentDependency[] = [
          {
            Id: 'dep1',
            RefMetadataComponentType: 'StandardEntity',
            RefMetadataComponentName: 'Contact',
          },
        ]
        buildFullProcessMocks(dependencies)

        // Act
        await sut.process()

        // Assert
        expect(vi.mocked(ApexClassTypeMatcher)).toHaveBeenCalledWith(
          new Set([])
        )
      })

      it('Given no sObject dependencies, When processing, Then SObjectTypeMatcher receives empty set', async () => {
        // Arrange
        const dependencies: MetadataComponentDependency[] = [
          {
            Id: 'dep1',
            RefMetadataComponentType: 'ApexClass',
            RefMetadataComponentName: 'MyHelper',
          },
        ]
        buildFullProcessMocks(dependencies)

        // Act
        await sut.process()

        // Assert
        expect(vi.mocked(SObjectTypeMatcher)).toHaveBeenCalledWith(
          new Set([]),
          expect.anything()
        )
      })

      it('Given CustomObject dependency only, When processing, Then SObjectTypeMatcher receives CustomObject name', async () => {
        // Arrange
        const dependencies: MetadataComponentDependency[] = [
          {
            Id: 'dep1',
            RefMetadataComponentType: 'CustomObject',
            RefMetadataComponentName: 'Order__c',
          },
        ]
        buildFullProcessMocks(dependencies)

        // Act
        await sut.process()

        // Assert
        expect(vi.mocked(SObjectTypeMatcher)).toHaveBeenCalledWith(
          new Set(['Order__c']),
          expect.anything()
        )
      })
    })

    describe('When filterTestMethods is called with no include or exclude configured', () => {
      it('Given no includeTestMethods or excludeTestMethods, When processing, Then all test methods are passed unchanged', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        const mockRunTestMethods = vi.fn().mockResolvedValue({
          summary: { outcome: 'Failed', passing: 0, failing: 1, testsRan: 1 },
        })
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = mockRunTestMethods
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 2,
              testMethodsPerLine: new Map([
                [1, new Set(['testMethodA', 'testMethodB'])],
              ]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert — all methods are passed, no filtering occurred
        expect(mockRunTestMethods).toHaveBeenCalledWith(
          'TestClassTest',
          new Set(['testMethodA', 'testMethodB'])
        )
      })
    })

    describe('When excludeTestMethods removes all methods for every line', () => {
      it('Given all lines have their only test method excluded, When processing, Then noCoverage error is thrown', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn()
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn()
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        const filteredSut = new MutationTestingService(
          progress,
          spinner,
          connection,
          {
            apexClassName: 'TestClass',
            apexTestClassName: 'TestClassTest',
            excludeTestMethods: ['testMethodA'],
          } as ApexMutationParameter,
          messagesMock
        )

        // Act & Assert
        await expect(filteredSut.process()).rejects.toThrow(
          "No test coverage found for 'TestClass'."
        )
      })
    })

    describe('When extractMutationOriginalText is called with empty apexClassContent', () => {
      it('Given empty apexClassContent, When called, Then it throws an error', () => {
        // Arrange
        sut['apexClassContent'] = ''
        const mutation = {
          mutationName: 'TestMutation',
          replacement: '0',
          target: {
            startToken: { startIndex: 0 },
            endToken: { stopIndex: 5 },
            text: 'hello',
          },
        }

        // Act & Assert
        expect(() =>
          sut['extractMutationOriginalText'](
            mutation as unknown as ApexMutation
          )
        ).toThrow('Failed to extract original text for mutation: TestMutation')
      })

      it('Given valid indices and non-empty apexClassContent, When called, Then it returns the substring', () => {
        // Arrange
        sut['apexClassContent'] = 'hello world'
        const mutation = {
          mutationName: 'TestMutation',
          replacement: '0',
          target: {
            startToken: { startIndex: 6 },
            endToken: { stopIndex: 10 },
            text: 'world',
          },
        }

        // Act
        const result = sut['extractMutationOriginalText'](
          mutation as unknown as ApexMutation
        )

        // Assert
        expect(result).toBe('world')
      })
    })

    describe('When rollback fails during process', () => {
      it('Given rollback throws, When processing completes, Then the rollback error is re-thrown and spinner shows a warning', async () => {
        // Arrange
        let updateCallCount = 0
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockImplementation(() => {
              updateCallCount++
              // First two calls (compile verification) succeed
              // Mutation deployment (3rd) succeeds
              // Rollback (last) fails
              if (updateCallCount <= 3) return Promise.resolve({})
              return Promise.reject(new Error('Rollback failed'))
            })
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act & Assert — rollback error must propagate so CI/CLI exits non-zero.
        // The class is left mutated on the org; the user must redeploy manually,
        // so silencing the failure would be dangerous.
        await expect(sut.process()).rejects.toThrow(
          /Rollback of 'TestClass' failed/
        )
        // Spinner shows a warning mentioning mutated state before the throw
        expect(spinner.stop).toHaveBeenCalledWith(
          expect.stringContaining('Rollback FAILED')
        )
      })

      it('Given rollback rejects a non-Error (string) value, Then String(error) is used as cause', async () => {
        // Arrange — this exercises the `instanceof Error ? error.message : String(error)` branch
        let updateCallCount = 0
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockImplementation(() => {
              updateCallCount++
              if (updateCallCount <= 3) return Promise.resolve({})
              // rollback path — rejects with a string, not Error
              return Promise.reject('plain string rollback failure')
            })
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act & Assert — the string error is coerced to String(error)
        await expect(sut.process()).rejects.toThrow(
          /plain string rollback failure/
        )
      })
    })

    describe('When dryRun defaults', () => {
      it('Given dryRun is not provided, When processing, Then mutations are executed (not dry run)', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        const mockRunTestMethods = vi.fn().mockResolvedValue({
          summary: { outcome: 'Failed', passing: 0, failing: 1, testsRan: 1 },
        })
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = mockRunTestMethods
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // sut is created without dryRun in beforeEach — it defaults to false
        // Act
        const result = await sut.process()

        // Assert — tests were actually run (not skipped as in dry run)
        expect(mockRunTestMethods).toHaveBeenCalled()
        expect(result.mutants[0].status).toBe('Killed')
      })
    })

    describe('When buildMutatorFilter is called with no mutator config', () => {
      it('Given neither includeMutators nor excludeMutators set, When processing, Then compute receives undefined filter', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        const mockComputeFn = vi
          .fn()
          .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = mockComputeFn
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert — compute called with undefined filter (neither include nor exclude)
        expect(mockComputeFn).toHaveBeenCalledWith(
          mockApexClass.Body,
          new Set([1]),
          expect.anything(),
          undefined,
          [],
          undefined,
          expect.objectContaining({
            tree: mockAnalyzeFullResult.tree,
            tokenStream: mockAnalyzeFullResult.tokenStream,
          })
        )
      })
    })

    describe('When error classification strategies are applied', () => {
      const buildMocksWithUpdateError = (updateError: Error) => {
        let updateCallCount = 0
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockImplementation(() => {
              updateCallCount++
              if (updateCallCount <= 2) return Promise.resolve({})
              if (updateCallCount === 3) return Promise.reject(updateError)
              return Promise.resolve({})
            })
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn()
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )
      }

      it('Given error message starting with "Deployment failed:", When evaluating mutation, Then status is CompileError', async () => {
        // Arrange
        buildMocksWithUpdateError(
          new Error('Deployment failed: [MyClass.cls:5:10] Invalid syntax')
        )

        // Act
        const result = await sut.process()

        // Assert
        expect(result.mutants[0].status).toBe('CompileError')
        expect(result.mutants[0].statusReason).toContain('Deployment failed:')
      })

      it('Given error message containing "LIMIT_USAGE_FOR_NS", When evaluating mutation via test runner throw, Then status is Killed', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi
              .fn()
              .mockRejectedValue(
                new Error('LIMIT_USAGE_FOR_NS : Too many SOQL queries: 101')
              )
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        const result = await sut.process()

        // Assert
        expect(result.mutants[0].status).toBe('Killed')
        expect(result.mutants[0].statusReason).toBeUndefined()
      })

      it('Given error not matching any specific pattern, When evaluating mutation, Then status is RuntimeError with message', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi
              .fn()
              .mockRejectedValue(new Error('Unexpected network timeout'))
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        const result = await sut.process()

        // Assert
        expect(result.mutants[0].status).toBe('RuntimeError')
        expect(result.mutants[0].statusReason).toBe(
          'Unexpected network timeout'
        )
      })
    })

    // convertAbsoluteIndexToLineColumn has been replaced with LineOffsetIndex
    // (Perf-6) which offers O(log n) lookup. Behavior is exercised through
    // calculateMutationPosition tests below.

    describe('When formatRemainingTime is called', () => {
      it('Given completedCount is 0, When called, Then returns empty string', () => {
        // Arrange
        const loopStartTime = performance.now()

        // Act
        const result = sut['formatRemainingTime'](loopStartTime, 0, 10)

        // Assert
        expect(result).toBe('')
      })

      it('Given completedCount greater than 0, When called, Then returns non-empty remaining time string', () => {
        // Arrange
        // Use a past start time to ensure elapsed > 0
        const loopStartTime = performance.now() - 1000

        // Act
        const result = sut['formatRemainingTime'](loopStartTime, 1, 10)

        // Assert
        expect(result).not.toBe('')
        expect(result).toContain('Remaining:')
      })

      it('Given completedCount equals totalCount, When called, Then returns remaining time with zero remaining', () => {
        // Arrange
        const loopStartTime = performance.now() - 1000

        // Act
        const result = sut['formatRemainingTime'](loopStartTime, 5, 5)

        // Assert
        expect(result).toContain('Remaining:')
        expect(result).toContain('|')
      })
    })

    describe('When spinner start/stop messages are verified', () => {
      const buildStandardMocks = () => {
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )
      }

      it('Given successful process, When processing, Then spinner shows fetch message for apex class', async () => {
        // Arrange
        buildStandardMocks()

        // Act
        await sut.process()

        // Assert
        expect(spinner.start).toHaveBeenCalledWith(
          'Fetching "TestClass" ApexClass content',
          undefined,
          { stdout: true }
        )
      })

      it('Given successful process, When processing, Then spinner shows Done after fetching', async () => {
        // Arrange
        buildStandardMocks()

        // Act
        await sut.process()

        // Assert
        expect(spinner.stop).toHaveBeenCalledWith('Done')
      })

      it('Given successful process, When processing, Then spinner shows type discovery message', async () => {
        // Arrange
        buildStandardMocks()

        // Act
        await sut.process()

        // Assert
        expect(spinner.start).toHaveBeenCalledWith(
          'Analyzing class dependencies for "TestClass"',
          undefined,
          { stdout: true }
        )
      })

      it('Given successful process, When processing, Then spinner shows compilation verification message', async () => {
        // Arrange
        buildStandardMocks()

        // Act
        await sut.process()

        // Assert
        expect(spinner.start).toHaveBeenCalledWith(
          'Verifying "TestClass" apex class compilation',
          undefined,
          { stdout: true }
        )
      })

      it('Given successful process, When processing, Then spinner shows test class compilation verification message', async () => {
        // Arrange
        buildStandardMocks()

        // Act
        await sut.process()

        // Assert
        expect(spinner.start).toHaveBeenCalledWith(
          'Verifying "TestClassTest" apex test class compilation',
          undefined,
          { stdout: true }
        )
      })

      it('Given successful process, When processing, Then spinner shows baseline test execution message', async () => {
        // Arrange
        buildStandardMocks()

        // Act
        await sut.process()

        // Assert
        expect(spinner.start).toHaveBeenCalledWith(
          'Executing "TestClassTest" tests to get coverage',
          undefined,
          { stdout: true }
        )
      })

      it('Given baseline tests pass, When processing, Then spinner shows original tests passed message', async () => {
        // Arrange
        buildStandardMocks()

        // Act
        await sut.process()

        // Assert
        expect(spinner.stop).toHaveBeenCalledWith('Original tests passed')
      })

      it('Given mutations generated, When processing, Then spinner shows mutation generation message', async () => {
        // Arrange
        buildStandardMocks()

        // Act
        await sut.process()

        // Assert
        expect(spinner.start).toHaveBeenCalledWith(
          'Generating mutants for "TestClass" ApexClass',
          undefined,
          { stdout: true }
        )
      })

      it('Given 1 mutation generated, When processing, Then spinner stop shows count of mutations', async () => {
        // Arrange
        buildStandardMocks()

        // Act
        await sut.process()

        // Assert
        expect(spinner.stop).toHaveBeenCalledWith('1 mutations generated')
      })

      it('Given successful rollback, When processing completes, Then spinner shows rollback message and Done', async () => {
        // Arrange
        buildStandardMocks()

        // Act
        await sut.process()

        // Assert
        expect(spinner.start).toHaveBeenCalledWith(
          'Rolling back "TestClass" ApexClass to its original state',
          undefined,
          { stdout: true }
        )
      })
    })

    describe('When progress messages during mutation loop are verified', () => {
      const buildMocksForMutationLoop = (testOutcome: 'Passed' | 'Failed') => {
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: testOutcome,
                passing: testOutcome === 'Passed' ? 1 : 0,
                failing: testOutcome === 'Failed' ? 1 : 0,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )
      }

      it('Given mutation passes tests (Survived), When processing, Then progress update shows "zombie" message', async () => {
        // Arrange
        buildMocksForMutationLoop('Passed')

        // Act
        await sut.process()

        // Assert — final progress update should contain the zombie message
        const updateCalls = vi.mocked(progress.update).mock.calls
        const allInfos = updateCalls.map(
          (call: [number, { info: string }]) => call[1].info
        )
        expect(allInfos.some((info: string) => info.includes('zombie'))).toBe(
          true
        )
      })

      it('Given mutation fails tests (Killed), When processing, Then progress update shows "mutant killed" message', async () => {
        // Arrange
        buildMocksForMutationLoop('Failed')

        // Act
        await sut.process()

        // Assert
        const updateCalls = vi.mocked(progress.update).mock.calls
        const allInfos = updateCalls.map(
          (call: [number, { info: string }]) => call[1].info
        )
        expect(
          allInfos.some((info: string) => info.includes('mutant killed'))
        ).toBe(true)
      })

      it('Given progress loop, When processing, Then progress.start uses "Starting mutation testing" info', async () => {
        // Arrange
        buildMocksForMutationLoop('Failed')

        // Act
        await sut.process()

        // Assert
        expect(progress.start).toHaveBeenCalledWith(
          1,
          { info: 'Starting mutation testing' },
          expect.anything()
        )
      })

      it('Given progress loop, When processing completes, Then progress.finish uses "All mutations evaluated" info', async () => {
        // Arrange
        buildMocksForMutationLoop('Failed')

        // Act
        await sut.process()

        // Assert
        expect(progress.finish).toHaveBeenCalledWith({
          info: 'All mutations evaluated',
        })
      })

      it('Given progress loop format, When processing, Then progress.start uses correct bar format string', async () => {
        // Arrange
        buildMocksForMutationLoop('Failed')

        // Act
        await sut.process()

        // Assert
        expect(progress.start).toHaveBeenCalledWith(
          expect.any(Number),
          expect.anything(),
          {
            title: 'MUTATION TESTING PROGRESS',
            format: '%s | {bar} | {value}/{total} {info}',
          }
        )
      })
    })

    describe('When progress messages for error classifications are verified', () => {
      it('Given compile error during mutation deployment, When processing, Then progress update shows compile error message with line number', async () => {
        // Arrange
        let updateCallCount = 0
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockImplementation(() => {
              updateCallCount++
              if (updateCallCount <= 2) return Promise.resolve({})
              // rollback (call 4) must succeed; only the mutation deploy (call 3) fails
              if (updateCallCount >= 4) return Promise.resolve({})
              return Promise.reject(
                new Error('Deployment failed: Invalid syntax')
              )
            })
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn()
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert — progress update should contain the compile error message
        const updateCalls = vi.mocked(progress.update).mock.calls
        const allInfos = updateCalls.map(
          (call: [number, { info: string }]) => call[1].info
        )
        expect(
          allInfos.some((info: string) =>
            info.includes('compile error at line')
          )
        ).toBe(true)
        // Verify the line number (startToken.line = 1) is in the message
        expect(
          allInfos.some((info: string) =>
            info.includes('compile error at line 1')
          )
        ).toBe(true)
      })

      it('Given governor limit exception during mutation test, When processing, Then progress update shows killed message with exception', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi
              .fn()
              .mockRejectedValue(
                new Error('LIMIT_USAGE_FOR_NS : Too many queries')
              )
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert
        const updateCalls = vi.mocked(progress.update).mock.calls
        const allInfos = updateCalls.map(
          (call: [number, { info: string }]) => call[1].info
        )
        expect(
          allInfos.some(
            (info: string) =>
              info.includes('mutant killed') &&
              info.includes('LIMIT_USAGE_FOR_NS')
          )
        ).toBe(true)
      })

      it('Given runtime error during mutation test, When processing, Then progress update shows runtime error message', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi
              .fn()
              .mockRejectedValue(new Error('Network connection lost'))
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert
        const updateCalls = vi.mocked(progress.update).mock.calls
        const allInfos = updateCalls.map(
          (call: [number, { info: string }]) => call[1].info
        )
        expect(
          allInfos.some(
            (info: string) =>
              info.includes('runtime error') &&
              info.includes('Network connection lost')
          )
        ).toBe(true)
      })
    })

    describe('When progress update for deploying mutation is verified', () => {
      it('Given mutation at line 1, When processing, Then progress update shows deploying message with replacement and line', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert
        const updateCalls = vi.mocked(progress.update).mock.calls
        const allInfos = updateCalls.map(
          (call: [number, { info: string }]) => call[1].info
        )
        expect(
          allInfos.some((info: string) =>
            info.includes('Deploying "0" mutation at line 1')
          )
        ).toBe(true)
      })

      it('Given mutation at line 1 with test methods, When processing, Then progress update shows running test methods message', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert
        const updateCalls = vi.mocked(progress.update).mock.calls
        const allInfos = updateCalls.map(
          (call: [number, { info: string }]) => call[1].info
        )
        expect(
          allInfos.some(
            (info: string) =>
              info.includes('Running') &&
              info.includes('tests methods') &&
              info.includes('"0" mutation at line 1')
          )
        ).toBe(true)
      })
    })

    describe('When displayTimeEstimate arithmetic is verified', () => {
      it('Given deployTime 2000ms and testTime 3000ms with 1 mutation, When processing, Then formatDuration receives combined time', async () => {
        // Arrange
        vi.mocked(timeExecution)
          .mockImplementationOnce(async (fn: () => Promise<unknown>) => {
            const result = await fn()
            return { result, durationMs: 2000 }
          })
          .mockImplementationOnce(async (fn: () => Promise<unknown>) => {
            const result = await fn()
            return { result, durationMs: 3000 }
          })

        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert — totalEstimateMs = (2000 + 3000) * 1 = 5000
        expect(vi.mocked(formatDuration)).toHaveBeenCalledWith(5000)
      })

      it('Given deployTime 1000ms and testTime 2000ms with 2 mutations, When processing, Then formatDuration receives multiplied time', async () => {
        // Arrange
        const secondMutation = { ...mockMutation, replacement: '1' }
        vi.mocked(timeExecution)
          .mockImplementationOnce(async (fn: () => Promise<unknown>) => {
            const result = await fn()
            return { result, durationMs: 1000 }
          })
          .mockImplementationOnce(async (fn: () => Promise<unknown>) => {
            const result = await fn()
            return { result, durationMs: 2000 }
          })

        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi.fn().mockReturnValue({
              mutations: [mockMutation, secondMutation],
              tokenStream: {},
            })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert — totalEstimateMs = (1000 + 2000) * 2 = 6000
        expect(vi.mocked(formatDuration)).toHaveBeenCalledWith(6000)
      })
    })

    describe('When zero mutations are generated, Then spinner stop message includes count', () => {
      it('Given no mutations generated, When processing, Then spinner stop shows "0 mutations generated"', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [], tokenStream: {} })
            mutate = vi.fn()
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethod'])]]),
            })
          }
        )

        // Act & Assert
        await expect(sut.process()).rejects.toThrow()
        expect(spinner.stop).toHaveBeenCalledWith('0 mutations generated')
      })
    })

    // Column calculation is now covered by calculateMutationPosition tests
    // that seed sut['lineOffsetIndex'] directly.

    describe('When calculateMutationPosition is verified with valid indices', () => {
      // Use the real LineOffsetIndex — keeps the test honest. An inlined
      // duplicate implementation would pass even if the production logic
      // drifted from the spec.
      it('Given mutation with valid start/end indices, When calculating position, Then returns correct start and end', () => {
        // Arrange — 'hello world', startIndex=6, stopIndex=10
        sut['lineOffsetIndex'] = new LineOffsetIndex('hello world')
        const mutation = {
          mutationName: 'TestMutation',
          replacement: 'foo',
          target: {
            startToken: { startIndex: 6, stopIndex: 10 },
            endToken: { startIndex: 6, stopIndex: 10 },
            text: 'world',
          },
        }

        // Act
        const result = sut['calculateMutationPosition'](
          mutation as unknown as ApexMutation
        )

        // Assert
        expect(result.start).toEqual({ line: 1, column: 7 })
        expect(result.end).toEqual({ line: 1, column: 12 })
      })

      it('Given mutation spanning two lines, When calculating position, Then end is on second line', () => {
        // Arrange — 'line1\nline2', startIndex=0, stopIndex=10
        sut['lineOffsetIndex'] = new LineOffsetIndex('line1\nline2')
        const mutation = {
          mutationName: 'TestMutation',
          replacement: 'x',
          target: {
            startToken: { startIndex: 0, stopIndex: 10 },
            endToken: { startIndex: 0, stopIndex: 10 },
            text: 'line1\nline2',
          },
        }

        // Act
        const result = sut['calculateMutationPosition'](
          mutation as unknown as ApexMutation
        )

        // Assert
        expect(result.start).toEqual({ line: 1, column: 1 })
        expect(result.end).toEqual({ line: 2, column: 6 })
      })
    })

    describe('When extractMutationOriginalText stopIndex + 1 is verified', () => {
      it('Given apexClassContent and valid indices, When extracting, Then uses stopIndex + 1 as exclusive end', () => {
        // Arrange — 'hello world', startIndex=0, stopIndex=4 => 'hello' (indices 0..4 inclusive)
        sut['apexClassContent'] = 'hello world'
        const mutation = {
          mutationName: 'TestMutation',
          replacement: '0',
          target: {
            startToken: { startIndex: 0 },
            endToken: { stopIndex: 4 },
            text: 'hello',
          },
        }

        // Act
        const result = sut['extractMutationOriginalText'](
          mutation as unknown as ApexMutation
        )

        // Assert — substring(0, 4+1) = substring(0, 5) = 'hello'
        expect(result).toBe('hello')
      })

      it('Given apexClassContent and indices at the very end, When extracting, Then extracts last character correctly', () => {
        // Arrange
        sut['apexClassContent'] = 'abc'
        const mutation = {
          mutationName: 'TestMutation',
          replacement: '0',
          target: {
            startToken: { startIndex: 2 },
            endToken: { stopIndex: 2 },
            text: 'c',
          },
        }

        // Act
        const result = sut['extractMutationOriginalText'](
          mutation as unknown as ApexMutation
        )

        // Assert — substring(2, 3) = 'c'
        expect(result).toBe('c')
      })
    })

    describe('When buildMutantResult id format is verified', () => {
      it('Given a mutation, When building mutant result, Then id contains all expected parts in order', async () => {
        // Arrange — Use process flow to capture the result with known mutation token values
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        const result = await sut.process()

        // Assert — id format: ${apexClassName}-${line}-${column}-${tokenIndex}-${timestamp}
        // mockMutation: line=1, charPositionInLine=50, tokenIndex=5
        const mutantId = result.mutants[0].id
        expect(mutantId).toMatch(/^TestClass-1-50-5-\d+$/)
      })
    })

    describe('When filterTestMethods filterSet is the excludeTestMethods set', () => {
      it('Given excludeTestMethods with multiple methods, When processing, Then excludes all listed methods', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        const mockRunTestMethods = vi.fn().mockResolvedValue({
          summary: { outcome: 'Failed', passing: 0, failing: 1, testsRan: 1 },
        })
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = mockRunTestMethods
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 3,
              testMethodsPerLine: new Map([
                [1, new Set(['testMethodA', 'testMethodB', 'testMethodC'])],
              ]),
            })
          }
        )

        const filteredSut = new MutationTestingService(
          progress,
          spinner,
          connection,
          {
            apexClassName: 'TestClass',
            apexTestClassName: 'TestClassTest',
            excludeTestMethods: ['testMethodA', 'testMethodB'],
          } as ApexMutationParameter,
          messagesMock
        )

        // Act
        await filteredSut.process()

        // Assert — only testMethodC remains
        expect(mockRunTestMethods).toHaveBeenCalledWith(
          'TestClassTest',
          new Set(['testMethodC'])
        )
      })
    })

    describe('When evaluateMutation constructs mutant id correctly', () => {
      it('Given error during mutation evaluation, When processing, Then error path id has same format as success path', async () => {
        // Arrange
        let updateCallCount = 0
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockImplementation(() => {
              updateCallCount++
              if (updateCallCount <= 2) return Promise.resolve({})
              // rollback (call 4) must succeed; only the mutation deploy (call 3) fails
              if (updateCallCount >= 4) return Promise.resolve({})
              return Promise.reject(
                new Error('Deployment failed: syntax error')
              )
            })
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn()
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        const result = await sut.process()

        // Assert — id format: ${apexClassName}-${line}-${column}-${tokenIndex}-${timestamp}
        const mutantId = result.mutants[0].id
        expect(mutantId).toMatch(/^TestClass-1-50-5-\d+$/)
      })
    })

    describe('When buildDryRunResult id format is verified', () => {
      it('Given dry run, When processing, Then mutant id uses startToken fields for line/column/tokenIndex', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn()
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn()
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        const dryRunService = new MutationTestingService(
          progress,
          spinner,
          connection,
          {
            apexClassName: 'TestClass',
            apexTestClassName: 'TestClassTest',
            dryRun: true,
          } as ApexMutationParameter,
          messagesMock
        )

        // Act
        const result = await dryRunService.process()

        // Assert — id uses startToken: line=1, charPositionInLine=50, tokenIndex=5
        const mutantId = result.mutants[0].id
        expect(mutantId).toMatch(/^TestClass-1-50-5-\d+$/)
      })
    })

    describe('When baseline tests fail, Then error message contains interpolated outcome and failing count', () => {
      it('Given outcome is "Error" and failing is 3, When processing, Then error message includes outcome and failing values', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Error',
              passing: 0,
              failing: 3,
              testsRan: 3,
              testMethodsPerLine: new Map(),
            })
          }
        )

        // Act & Assert — the template literal interpolates ${outcome} and ${failing}
        await expect(sut.process()).rejects.toThrow('Test outcome: Error')
        await expect(sut.process()).rejects.toThrow('Failing tests: 3')
      })
    })

    describe('When no tests are executed, Then error message contains interpolated class name', () => {
      it('Given testsRan is 0, When processing, Then error message includes test class name', async () => {
        // Arrange
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 0,
              failing: 0,
              testsRan: 0,
              testMethodsPerLine: new Map(),
            })
          }
        )

        // Act & Assert — the template literal interpolates ${this.apexTestClassName}
        await expect(sut.process()).rejects.toThrow(
          "- Test class 'TestClassTest' exists"
        )
        await expect(sut.process()).rejects.toThrow(
          '- Test methods have @IsTest annotation'
        )
        await expect(sut.process()).rejects.toThrow(
          '- Test class is properly deployed'
        )
      })
    })

    describe('When progress messages contain error classification strings', () => {
      it('Given compile error, When processing, Then progress message starts with "Mutation result: "', async () => {
        // Arrange — kills StringLiteral mutant that removes the "Mutation result: " prefix
        let updateCallCount = 0
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockImplementation(() => {
              updateCallCount++
              if (updateCallCount <= 2) return Promise.resolve({})
              // rollback (call 4) must succeed; only the mutation deploy (call 3) fails
              if (updateCallCount >= 4) return Promise.resolve({})
              return Promise.reject(
                new Error('Deployment failed: Invalid syntax')
              )
            })
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn()
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert — full prefix "Mutation result: compile error at line" must be present
        const updateCalls = vi.mocked(progress.update).mock.calls
        const allInfos = updateCalls.map(
          (call: [number, { info: string }]) => call[1].info
        )
        expect(
          allInfos.some((info: string) =>
            info.includes('Mutation result: compile error at line')
          )
        ).toBe(true)
      })

      it('Given governor limit exception, When processing, Then progress message contains "(msg)" wrapper around exception', async () => {
        // Arrange — kills StringLiteral mutant that removes the "(${msg})" suffix from progress message
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi
              .fn()
              .mockRejectedValue(
                new Error('LIMIT_USAGE_FOR_NS : Too many queries')
              )
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert — progress message must be "Mutation result: mutant killed (LIMIT_USAGE_FOR_NS : Too many queries)"
        const updateCalls = vi.mocked(progress.update).mock.calls
        const allInfos = updateCalls.map(
          (call: [number, { info: string }]) => call[1].info
        )
        expect(
          allInfos.some((info: string) =>
            info.includes(
              'Mutation result: mutant killed (LIMIT_USAGE_FOR_NS : Too many queries)'
            )
          )
        ).toBe(true)
      })

      it('Given runtime error, When processing, Then progress message contains "(msg)" wrapper around error message', async () => {
        // Arrange — kills StringLiteral mutant that removes the "(${msg})" suffix from runtime error progress message
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi
              .fn()
              .mockResolvedValue([] as MetadataComponentDependency[])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi
              .fn()
              .mockRejectedValue(new Error('Network connection lost'))
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert — progress message must be "Mutation result: runtime error (Network connection lost)"
        const updateCalls = vi.mocked(progress.update).mock.calls
        const allInfos = updateCalls.map(
          (call: [number, { info: string }]) => call[1].info
        )
        expect(
          allInfos.some((info: string) =>
            info.includes(
              'Mutation result: runtime error (Network connection lost)'
            )
          )
        ).toBe(true)
      })
    })

    describe('When buildMutantResult determines status', () => {
      it("Given outcome is 'Passed', When building result, Then status is 'Survived' not 'Killed'", async () => {
        // Arrange — kills EqualityOperator mutant: outcome === 'Passed' → outcome !== 'Passed'
        // If mutated to !==, outcome='Passed' would produce 'Killed' instead of 'Survived'
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Passed',
                passing: 1,
                failing: 0,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        const result = await sut.process()

        // Assert — outcome 'Passed' means test survived the mutation → status is 'Survived'
        expect(result.mutants[0].status).toBe('Survived')
        expect(result.mutants[0].status).not.toBe('Killed')
      })

      it("Given outcome is 'Failed', When building result, Then status is 'Killed' not 'Survived'", async () => {
        // Arrange — ensures both branches of the ternary are independently verified
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        const result = await sut.process()

        // Assert — outcome 'Failed' means mutation was killed → status is 'Killed'
        expect(result.mutants[0].status).toBe('Killed')
        expect(result.mutants[0].status).not.toBe('Survived')
      })
    })

    describe('When evaluateMutation progress message reflects outcome', () => {
      it("Given outcome is 'Passed', When processing, Then progress message is 'zombie' (not 'mutant killed')", async () => {
        // Arrange — kills EqualityOperator mutant: outcome === 'Passed' → outcome !== 'Passed'
        // If mutated to !==, 'zombie' and 'mutant killed' would be swapped
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Passed',
                passing: 1,
                failing: 0,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert — outcome 'Passed' → 'zombie' message; must NOT show 'mutant killed'
        const updateCalls = vi.mocked(progress.update).mock.calls
        const allInfos = updateCalls.map(
          (call: [number, { info: string }]) => call[1].info
        )
        expect(allInfos.some((info: string) => info.includes('zombie'))).toBe(
          true
        )
        expect(
          allInfos.some((info: string) => info.includes('mutant killed'))
        ).toBe(false)
      })

      it("Given outcome is 'Failed', When processing, Then progress message is 'mutant killed' (not 'zombie')", async () => {
        // Arrange — kills StringLiteral mutants for 'zombie' and 'mutant killed' strings
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        await sut.process()

        // Assert — outcome 'Failed' → 'mutant killed' message; must NOT show 'zombie'
        const updateCalls = vi.mocked(progress.update).mock.calls
        const allInfos = updateCalls.map(
          (call: [number, { info: string }]) => call[1].info
        )
        expect(
          allInfos.some((info: string) => info.includes('mutant killed'))
        ).toBe(true)
        expect(allInfos.some((info: string) => info.includes('zombie'))).toBe(
          false
        )
      })
    })

    describe('When formatRemainingTime arithmetic is verified', () => {
      it('Given completedCount 2 and totalCount 10, When called, Then formatDuration receives correct remaining time proportional to elapsed', () => {
        // Arrange — kills arithmetic operator mutants: elapsed/completedCount → *; avgPerMutant*(total-completed) → other
        // With completedCount=2, totalCount=10: avgPerMutant = elapsed/2; remaining = (elapsed/2) * 8 = elapsed*4
        // If / → *: avgPerMutant = elapsed*2; remaining = elapsed*2*8 = elapsed*16 (different)
        // If * → /: remaining = (elapsed/2) / 8 = elapsed/16 (different)
        // We verify formatDuration is called with a specific computed value.
        // loopStartTime is passed as argument; performance.now() is called once inside the function.
        const mockFormatDuration = vi.mocked(formatDuration)
        mockFormatDuration.mockReturnValue('~8s')

        // Mock performance.now() to return loopStartTime + 100 (elapsed = 100ms)
        const loopStartTime = 10000
        const fakeNow = vi.spyOn(performance, 'now')
        fakeNow.mockReturnValue(loopStartTime + 100) // elapsed = 100

        // Act
        const result = sut['formatRemainingTime'](loopStartTime, 2, 10)

        // Assert — elapsed=100, avgPerMutant=100/2=50, remainingMs=50*(10-2)=400
        expect(mockFormatDuration).toHaveBeenCalledWith(400)
        expect(result).toContain('Remaining:')
        expect(result).toContain('~8s')
        expect(result).toContain(' | ')

        fakeNow.mockRestore()
      })

      it('Given completedCount equals totalCount, When called, Then formatDuration receives 0 as remainingMs', () => {
        // Arrange — kills arithmetic mutant: totalCount - completedCount → +
        // When all mutations processed, remainingMs = avgPerMutant * (10 - 10) = 0
        // If - → +, remainingMs = avgPerMutant * (10 + 10) = avgPerMutant * 20 ≠ 0
        const mockFormatDuration = vi.mocked(formatDuration)
        mockFormatDuration.mockReturnValue('~0s')

        const loopStartTime = 5000
        const fakeNow = vi.spyOn(performance, 'now')
        fakeNow.mockReturnValue(loopStartTime + 200) // elapsed = 200

        // Act
        const result = sut['formatRemainingTime'](loopStartTime, 10, 10)

        // Assert — remaining = (200/10) * (10-10) = 20 * 0 = 0
        expect(mockFormatDuration).toHaveBeenCalledWith(0)
        expect(result).toContain(' | ')

        fakeNow.mockRestore()
      })
    })

    describe('When formatRemainingTime return value format is verified', () => {
      it('Given completedCount > 0, When called, Then returns string ending with " | "', () => {
        // Arrange — kills StringLiteral mutant that removes " | " suffix from the return template
        const loopStartTime = 1000
        const fakeNow = vi.spyOn(performance, 'now')
        fakeNow.mockReturnValue(loopStartTime + 500) // elapsed = 500

        // Act
        const result = sut['formatRemainingTime'](loopStartTime, 1, 5)

        // Assert — suffix " | " must be present (not just "Remaining:")
        expect(result).toMatch(/\| $/)

        fakeNow.mockRestore()
      })

      it('Given completedCount is 0, When called, Then returns exactly empty string (not " | ")', () => {
        // Arrange — kills StringLiteral mutant that changes '' return to "Stryker was here" or similar
        // Also kills EqualityOperator === 0 → !== 0 (which would return '' for non-zero instead)
        const loopStartTime = performance.now()

        // Act
        const result = sut['formatRemainingTime'](loopStartTime, 0, 10)

        // Assert — must be exactly '' not " | " or any other string
        expect(result).toBe('')
        expect(result).not.toContain('|')
      })
    })

    describe('When evaluateMutation conditional statusReason spread is verified', () => {
      it('Given LIMIT_USAGE_FOR_NS error (Killed), When processing, Then statusReason is absent from mutant result', async () => {
        // Arrange — kills LogicalOperator mutant: classification.statusReason && {...} → || {...}
        // With ||, even when statusReason is undefined/falsy, the spread would still include it
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi
              .fn()
              .mockRejectedValue(
                new Error('LIMIT_USAGE_FOR_NS : Too many SOQL queries')
              )
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        const result = await sut.process()

        // Assert — Killed via governor limit must NOT have statusReason property
        expect(result.mutants[0].status).toBe('Killed')
        expect(Object.hasOwn(result.mutants[0], 'statusReason')).toBe(false)
      })

      it('Given CompileError, When processing, Then statusReason IS present on mutant result', async () => {
        // Arrange — ensures the truthy branch of classification.statusReason && {...} spreads the key
        let updateCallCount = 0
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockImplementation(() => {
              updateCallCount++
              if (updateCallCount <= 2) return Promise.resolve({})
              // rollback (call 4) must succeed; only the mutation deploy (call 3) fails
              if (updateCallCount >= 4) return Promise.resolve({})
              return Promise.reject(
                new Error('Deployment failed: type mismatch')
              )
            })
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn()
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        // Act
        const result = await sut.process()

        // Assert — CompileError must have statusReason set
        expect(result.mutants[0].status).toBe('CompileError')
        expect(Object.hasOwn(result.mutants[0], 'statusReason')).toBe(true)
        expect(result.mutants[0].statusReason).toBe(
          'Deployment failed: type mismatch'
        )
      })
    })

    describe('When dryRun defaults to false', () => {
      it('Given dryRun is explicitly false, When processing, Then mutations are executed (not dry run)', async () => {
        // Arrange — kills ?? → || mutation: false || false = false (same), but tests that false is
        // correctly passed through the ?? operator when dryRun is explicitly false
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = vi
              .fn()
              .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        const mockRunTestMethods = vi.fn().mockResolvedValue({
          summary: { outcome: 'Failed', passing: 0, failing: 1, testsRan: 1 },
        })
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = mockRunTestMethods
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        const explicitFalseSut = new MutationTestingService(
          progress,
          spinner,
          connection,
          {
            apexClassName: 'TestClass',
            apexTestClassName: 'TestClassTest',
            dryRun: false,
          } as ApexMutationParameter,
          messagesMock
        )

        // Act
        const result = await explicitFalseSut.process()

        // Assert — explicit false dryRun means tests are run
        expect(mockRunTestMethods).toHaveBeenCalled()
        expect(result.mutants[0].status).toBe('Killed')
      })
    })

    describe('When skipPatterns are provided to constructor, Then they are forwarded to mutantGenerator.compute', () => {
      it('Given skipPatterns in constructor, When processing, Then compute receives compiled skip patterns', async () => {
        // Arrange — kills survivors related to this.skipPatterns being passed to compute()
        // No existing test creates the service with skipPatterns set
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        const mockComputeFn = vi
          .fn()
          .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = mockComputeFn
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        const serviceWithPatterns = new MutationTestingService(
          progress,
          spinner,
          connection,
          {
            apexClassName: 'TestClass',
            apexTestClassName: 'TestClassTest',
            skipPatterns: ['System\\.debug'],
          } as ApexMutationParameter,
          messagesMock
        )

        // Act
        await serviceWithPatterns.process()

        // Assert — compute must receive the compiled RE2 instances (non-empty array), not []
        const computeCall = mockComputeFn.mock.calls[0]
        const passedSkipPatterns = computeCall[4]
        expect(passedSkipPatterns).toHaveLength(1)
      })
    })

    describe('When lines are provided to constructor, Then they are forwarded to mutantGenerator.compute', () => {
      it('Given lines in constructor, When processing, Then compute receives parsed line ranges as Set', async () => {
        // Arrange — kills survivors related to this.allowedLines being passed to compute()
        // No existing test creates the service with lines set
        vi.mocked(ApexClassRepository).mockImplementation(
          class {
            read = vi.fn().mockImplementation((name: string) => {
              if (name === 'TestClass') return Promise.resolve(mockApexClass)
              return Promise.resolve(mockTestClass)
            })
            update = vi.fn().mockResolvedValue({})
            getApexClassDependencies = vi.fn().mockResolvedValue([])
          }
        )
        const mockComputeFn = vi
          .fn()
          .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
        vi.mocked(MutantGenerator).mockImplementation(
          class {
            compute = mockComputeFn
            mutate = vi.fn().mockReturnValue('mutated code')
          }
        )
        vi.mocked(ApexTestRunner).mockImplementation(
          class {
            runTestMethods = vi.fn().mockResolvedValue({
              summary: {
                outcome: 'Failed',
                passing: 0,
                failing: 1,
                testsRan: 1,
              },
            })
            getTestMethodsPerLines = vi.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            })
          }
        )

        const serviceWithLines = new MutationTestingService(
          progress,
          spinner,
          connection,
          {
            apexClassName: 'TestClass',
            apexTestClassName: 'TestClassTest',
            lines: ['1-5'],
          } as ApexMutationParameter,
          messagesMock
        )

        // Act
        await serviceWithLines.process()

        // Assert — compute must receive a Set of line numbers, not undefined
        const computeCall = mockComputeFn.mock.calls[0]
        const passedAllowedLines = computeCall[5]
        expect(passedAllowedLines).toBeInstanceOf(Set)
        expect(passedAllowedLines).toEqual(new Set([1, 2, 3, 4, 5]))
      })
    })

    describe('When calculateScore handles boundary cases', () => {
      it('Given only Survived and Killed mutants, When calculating score, Then compile error filter has no effect', () => {
        // Arrange
        const mockResult = {
          sourceFile: 'TestClass',
          sourceFileContent: 'content',
          testFile: 'TestClassTest',
          mutants: [{ status: 'Killed' }, { status: 'Survived' }],
        } as ApexMutationTestResult

        // Act
        const score = sut.calculateScore(mockResult)

        // Assert — 1 killed / 2 valid = 50%
        expect(score).toBe(50)
      })

      it('Given all mutants have status Killed, When calculating score, Then score is 100', () => {
        // Arrange
        const mockResult = {
          sourceFile: 'TestClass',
          sourceFileContent: 'content',
          testFile: 'TestClassTest',
          mutants: [
            { status: 'Killed' },
            { status: 'Killed' },
            { status: 'Killed' },
          ],
        } as ApexMutationTestResult

        // Act
        const score = sut.calculateScore(mockResult)

        // Assert
        expect(score).toBe(100)
      })
    })
  })
})

describe('LineOffsetIndex', () => {
  it('Given single-line source, When positionAt 0, Then returns line 1 column 1', () => {
    // Arrange
    const sut = new LineOffsetIndex('hello')

    // Act
    const result = sut.positionAt(0)

    // Assert
    expect(result).toEqual({ line: 1, column: 1 })
  })

  it('Given multi-line source, When positionAt the start of line 2, Then returns line 2 column 1', () => {
    // Arrange — 'ab\ncd' => lineStarts=[0,3]; index 3 starts line 2
    const sut = new LineOffsetIndex('ab\ncd')

    // Act
    const result = sut.positionAt(3)

    // Assert
    expect(result).toEqual({ line: 2, column: 1 })
  })

  it('Given multi-line source, When positionAt a mid-line index, Then returns line N column K', () => {
    // Arrange — 'line1\nline2\nline3' => lineStarts=[0,6,12]; index 8 is 'n' of 'line2'
    const sut = new LineOffsetIndex('line1\nline2\nline3')

    // Act
    const result = sut.positionAt(8)

    // Assert
    expect(result).toEqual({ line: 2, column: 3 })
  })

  it('Given source with trailing newline, When positionAt end, Then reports the empty line after the newline', () => {
    // Arrange — 'ab\n' has lineStarts=[0,3]; index 3 is the start of the synthetic last line
    const sut = new LineOffsetIndex('ab\n')

    // Act
    const result = sut.positionAt(3)

    // Assert
    expect(result).toEqual({ line: 2, column: 1 })
  })
})
