import { ApexTestResultOutcome, TestLevel } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import { ApexTestRunner } from '../../../src/adapter/apexTestRunner.js'
import type { TestMethodId } from '../../../src/type/TestMethodId.js'

const runTestAsynchronousMock = vi.fn()

vi.mock('@salesforce/apex-node', async importOriginal => {
  const actual = await importOriginal<typeof import('@salesforce/apex-node')>()
  return {
    ...actual,
    TestService: vi.fn().mockImplementation(
      class {
        runTestAsynchronous = runTestAsynchronousMock
      }
    ),
  }
})

describe('ApexTestRunner', () => {
  let connectionStub: Connection
  let sut: ApexTestRunner

  beforeEach(() => {
    connectionStub = {} as Connection
    sut = new ApexTestRunner(connectionStub)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('when getting covered lines', () => {
    describe('given the test execution is successful', () => {
      it('then should delegate coverage shaping to the injected strategy and return the trimmed result', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 1,
            failing: 0,
            testsRan: 1,
          },
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'per-test' as const,
          getTestMethodsPerLine: vi
            .fn()
            .mockReturnValue(new Map([[1, new Set(['testMethodA'])]])),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          ['TestClass'],
          strategyStub
        )

        // Assert
        expect(result).toEqual({
          outcome: 'Passed',
          testsRan: 1,
          failing: 0,
          compileFailures: [],
          otherFailureCount: 0,
          testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
        })
        expect(strategyStub.getTestMethodsPerLine).toHaveBeenCalledWith({
          ...mockTestResult,
          tests: [],
        })
        expect(runTestAsynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ className: 'TestClass' }],
            testLevel: TestLevel.RunSpecifiedTests,
            skipCodeCoverage: false,
            maxFailedTests: 0,
          },
          true
        )
      })
    })

    describe('given the baseline includes a CompileFail row', () => {
      const compileRow = {
        apexClass: { fullName: 'BrokenTest' },
        methodName: '<compile>',
        outcome: ApexTestResultOutcome.CompileFail,
        message: 'Invalid type: AmtProbeDep at line 3 column 5',
      }
      const passRow = {
        apexClass: { fullName: 'GoodTest' },
        methodName: 'addOneIncrements',
        outcome: ApexTestResultOutcome.Pass,
        message: null,
      }

      it('then should collect the compile failure and feed the strategy only the executed tests', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Failed',
            passing: 1,
            failing: 0,
            testsRan: 2,
          },
          tests: [compileRow, passRow],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'aggregate' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          ['BrokenTest', 'GoodTest'],
          strategyStub
        )

        // Assert — the injected strategy never sees the non-compiling row
        expect(result.compileFailures).toEqual([
          {
            className: 'BrokenTest',
            message: 'Invalid type: AmtProbeDep at line 3 column 5',
          },
        ])
        expect(result.otherFailureCount).toBe(0)
        expect(strategyStub.getTestMethodsPerLine).toHaveBeenCalledWith({
          ...mockTestResult,
          tests: [passRow],
        })
      })

      it('then should count a Fail row toward otherFailureCount', async () => {
        // Arrange
        const failRow = {
          apexClass: { fullName: 'FlakyTest' },
          methodName: 'itFails',
          outcome: ApexTestResultOutcome.Fail,
          message: 'System.AssertException: Assertion Failed',
        }
        const mockTestResult = {
          summary: { outcome: 'Failed', passing: 0, failing: 1, testsRan: 1 },
          tests: [failRow],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'aggregate' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          ['FlakyTest'],
          strategyStub
        )

        // Assert
        expect(result.otherFailureCount).toBe(1)
      })

      it('then should count a Skip row toward otherFailureCount', async () => {
        // Arrange
        const skipRow = {
          apexClass: { fullName: 'SkippedTest' },
          methodName: 'itIsSkipped',
          outcome: ApexTestResultOutcome.Skip,
          message: null,
        }
        const mockTestResult = {
          summary: { outcome: 'Failed', passing: 0, failing: 1, testsRan: 1 },
          tests: [skipRow],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'aggregate' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          ['SkippedTest'],
          strategyStub
        )

        // Assert
        expect(result.otherFailureCount).toBe(1)
      })

      it('then should dedupe CompileFail rows by folded class name and keep the first message', async () => {
        // Arrange
        const firstCompileRow = {
          apexClass: { fullName: 'BrokenTest' },
          methodName: '<compile>',
          outcome: ApexTestResultOutcome.CompileFail,
          message: 'Invalid type: AmtProbeDep at line 3 column 5',
        }
        const secondCompileRow = {
          apexClass: { fullName: 'brokentest' },
          methodName: '<compile>',
          outcome: ApexTestResultOutcome.CompileFail,
          message: 'Unrelated second diagnosis',
        }
        const mockTestResult = {
          summary: { outcome: 'Failed', passing: 0, failing: 0, testsRan: 2 },
          tests: [firstCompileRow, secondCompileRow],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'aggregate' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          ['BrokenTest'],
          strategyStub
        )

        // Assert
        expect(result.compileFailures).toEqual([
          {
            className: 'BrokenTest',
            message: 'Invalid type: AmtProbeDep at line 3 column 5',
          },
        ])
      })

      it('then should normalise a null compile message to an empty string', async () => {
        // Arrange
        const compileRowWithoutMessage = {
          apexClass: { fullName: 'BrokenTest' },
          methodName: '<compile>',
          outcome: ApexTestResultOutcome.CompileFail,
          message: null,
        }
        const mockTestResult = {
          summary: { outcome: 'Failed', passing: 0, failing: 0, testsRan: 1 },
          tests: [compileRowWithoutMessage],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'aggregate' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          ['BrokenTest'],
          strategyStub
        )

        // Assert
        expect(result.compileFailures).toEqual([
          { className: 'BrokenTest', message: '' },
        ])
      })
    })

    describe('given multiple test classes', () => {
      it('then should build one test entry per class in perimeter order', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 2,
            failing: 0,
            testsRan: 2,
          },
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'per-test' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        await sut.getTestMethodsPerLines(['A', 'B'], strategyStub)

        // Assert
        expect(runTestAsynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ className: 'A' }, { className: 'B' }],
            testLevel: TestLevel.RunSpecifiedTests,
            skipCodeCoverage: false,
            maxFailedTests: 0,
          },
          true
        )
      })
    })

    describe('given the test execution fails', () => {
      it('then should throw an error', async () => {
        // Arrange
        runTestAsynchronousMock.mockRejectedValue(
          new Error('Test execution failed')
        )
        const strategyStub = {
          fidelity: 'per-test' as const,
          getTestMethodsPerLine: vi.fn(),
        }

        // Act & Assert
        await expect(
          sut.getTestMethodsPerLines(['TestClass'], strategyStub)
        ).rejects.toThrow('Test execution failed')
      })
    })
  })

  describe('when running tests', () => {
    describe('given the test execution is successful', () => {
      it('then should return the test result', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
          },
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.runTestMethods(
          new Set<TestMethodId>(['TestClass.testMethod'])
        )

        // Assert — a single-class id set reproduces the byte-identical
        // single-element payload
        expect(result).toEqual(mockTestResult)
        expect(runTestAsynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ className: 'TestClass', testMethods: ['testMethod'] }],
            testLevel: TestLevel.RunSpecifiedTests,
            skipCodeCoverage: true,
            maxFailedTests: 0,
          },
          false
        )
      })
    })

    describe('given a mixed-class id set', () => {
      it('then should fold the ids into one test entry per declaring class', async () => {
        // Arrange
        const mockTestResult = { summary: { outcome: 'Passed' } }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        await sut.runTestMethods(
          new Set<TestMethodId>(['A.testOne', 'A.testTwo', 'B.testThree'])
        )

        // Assert — the class list is derived from the ids alone
        expect(runTestAsynchronousMock).toHaveBeenCalledWith(
          {
            tests: [
              { className: 'A', testMethods: ['testOne', 'testTwo'] },
              { className: 'B', testMethods: ['testThree'] },
            ],
            testLevel: TestLevel.RunSpecifiedTests,
            skipCodeCoverage: true,
            maxFailedTests: 0,
          },
          false
        )
      })
    })

    describe('given the test execution fails', () => {
      it('then should throw an error', async () => {
        // Arrange
        runTestAsynchronousMock.mockRejectedValue(
          new Error('Test execution failed')
        )

        // Act & Assert
        await expect(
          sut.runTestMethods(new Set<TestMethodId>(['TestClass.testMethod']))
        ).rejects.toThrow('Test execution failed')
      })
    })
  })
})
