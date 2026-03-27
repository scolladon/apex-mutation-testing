import { TestResult } from '@salesforce/apex-node'
import { Connection, Messages } from '@salesforce/core'
import { Progress, Spinner } from '@salesforce/sf-plugins-core'
import { ApexClassRepository } from '../../../src/adapter/apexClassRepository.js'
import { ApexTestRunner } from '../../../src/adapter/apexTestRunner.js'
import { SObjectDescribeRepository } from '../../../src/adapter/sObjectDescribeRepository.js'
import { MutantGenerator } from '../../../src/service/mutantGenerator.js'
import { MutationTestingService } from '../../../src/service/mutationTestingService.js'
import {
  formatDuration,
  timeExecution,
} from '../../../src/service/timeUtils.js'
import { TypeDiscoverer } from '../../../src/service/typeDiscoverer.js'
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

    const mockTypeRegistry = {}
    vi.mocked(TypeDiscoverer).mockImplementation(
      class {
        withMatcher = vi.fn().mockReturnThis()
        analyze = vi.fn().mockResolvedValue(mockTypeRegistry)
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
              if (updateCallCount <= 2) return Promise.resolve({})
              if (updateError) return Promise.reject(updateError)
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
            compute = vi.fn().mockReturnValue([mockMutation])
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
            compute = vi.fn().mockReturnValue([mockMutation])
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
            compute = vi.fn().mockReturnValue([]) // No mutations
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
            compute = vi.fn().mockReturnValue([mockMutation])
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
            compute = vi.fn().mockReturnValue([mockMutation])
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
            compute = vi.fn().mockReturnValue([mockMutation, secondMutation])
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
        const mockComputeFn = vi.fn().mockReturnValue([mockMutation])
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
        const mockComputeFn = vi.fn().mockReturnValue([mockMutation])
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
        const mockComputeFn = vi.fn().mockReturnValue([mockMutation])
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
          undefined
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
        const mockComputeFn = vi.fn().mockReturnValue([mockMutation])
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
          undefined
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
        const mockComputeFn = vi.fn().mockReturnValue([mockMutation])
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
          undefined
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
  })
})
