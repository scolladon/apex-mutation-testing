import { ApexTestResultOutcome, TestLevel } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import { ApexTestRunner } from '../../../src/adapter/apexTestRunner.js'
import type { TestMethodId } from '../../../src/type/TestMethodId.js'

const runTestAsynchronousMock = vi.fn()
const runTestSynchronousMock = vi.fn()

vi.mock('@salesforce/apex-node', async importOriginal => {
  const actual = await importOriginal<typeof import('@salesforce/apex-node')>()
  return {
    ...actual,
    TestService: vi.fn().mockImplementation(
      class {
        runTestAsynchronous = runTestAsynchronousMock
        runTestSynchronous = runTestSynchronousMock
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
        const passRow = {
          apexClass: { fullName: 'TestClass' },
          methodName: 'testMethodA',
          outcome: ApexTestResultOutcome.Pass,
          message: null,
        }
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 1,
            failing: 0,
            testsRan: 1,
          },
          tests: [passRow],
        }
        runTestSynchronousMock.mockResolvedValue(mockTestResult)
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

        // Assert — a single-class perimeter routes through the synchronous
        // transport, with no `testLevel` key on the payload
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
          tests: [passRow],
        })
        expect(runTestSynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ className: 'TestClass' }],
            skipCodeCoverage: false,
            maxFailedTests: 0,
          },
          true
        )
        expect(runTestAsynchronousMock).not.toHaveBeenCalled()
      })
    })

    describe('given the baseline includes a @TestSetup method', () => {
      // A setup method cannot be re-run alone, so it must never surface as
      // an executable test — not a TestMethodId, not covering-test
      // attribution, not a counted execution.
      const setupTestClass = { fullName: 'AmtSetupTest' }
      const firstRealRow = {
        apexClass: setupTestClass,
        methodName: 'itDoesSomething',
        outcome: ApexTestResultOutcome.Pass,
        message: null,
      }
      const secondRealRow = {
        apexClass: { fullName: 'OtherTest' },
        methodName: 'itDoesSomethingElse',
        outcome: ApexTestResultOutcome.Pass,
        message: null,
      }
      const setupEntry = {
        apexClass: setupTestClass,
        methodName: 'setUpData',
        testSetupTime: 12,
      }

      it('then should exclude a setup method reported through TestResult.setup from coverage and the executed-test count', async () => {
        // Arrange — two classes in the perimeter stay on the asynchronous
        // transport, where a modern org already keeps the setup row out of
        // `tests` and reports it through `setup` instead
        const mockTestResult = {
          summary: { outcome: 'Passed', passing: 2, failing: 0, testsRan: 3 },
          tests: [firstRealRow, secondRealRow],
          setup: [setupEntry],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'aggregate' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          ['AmtSetupTest', 'OtherTest'],
          strategyStub
        )

        // Assert — testsRan reflects the two re-runnable methods only, and
        // the strategy is never handed the setup row
        expect(result.testsRan).toBe(2)
        expect(strategyStub.getTestMethodsPerLine).toHaveBeenCalledWith({
          ...mockTestResult,
          tests: [firstRealRow, secondRealRow],
        })
      })

      it('then should exclude a row appearing in both tests and setup, matching identity case-insensitively', async () => {
        // Arrange — defends against a row surfacing in both places: cross-
        // referencing TestResult.setup rather than trusting a row's mere
        // absence from `tests` keeps the exclusion correct regardless of the
        // org's API version or any SDK quirk that leaves a setup row mixed
        // into `tests`
        const duplicatedSetupRow = {
          apexClass: { fullName: 'amtsetuptest' },
          methodName: 'SETUPDATA',
          outcome: ApexTestResultOutcome.Pass,
          message: null,
        }
        const mockTestResult = {
          summary: { outcome: 'Passed', passing: 2, failing: 0, testsRan: 3 },
          tests: [duplicatedSetupRow, firstRealRow, secondRealRow],
          setup: [setupEntry],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'aggregate' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          ['AmtSetupTest', 'OtherTest'],
          strategyStub
        )

        // Assert
        expect(result.testsRan).toBe(2)
        expect(strategyStub.getTestMethodsPerLine).toHaveBeenCalledWith({
          ...mockTestResult,
          tests: [firstRealRow, secondRealRow],
        })
      })

      it('then should derive testsRan from the row count rather than trusting summary.testsRan on the synchronous transport too', async () => {
        // Arrange — a single-class perimeter stays on the synchronous
        // transport. summary.testsRan is deliberately stale here, the same
        // way the asynchronous summary above over-counts by including the
        // setup row: testsRan must come from the rows actually kept, on
        // either transport, not from the org-reported summary field.
        runTestSynchronousMock.mockResolvedValue({
          summary: { outcome: 'Passed', passing: 2, failing: 0, testsRan: 99 },
          tests: [firstRealRow, secondRealRow],
        })
        const strategyStub = {
          fidelity: 'per-test' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        const syncResult = await sut.getTestMethodsPerLines(
          ['AmtSetupTest'],
          strategyStub
        )

        // Assert — the same testsRan the asynchronous fixture above reports
        // for the identical two re-runnable methods, even though that
        // fixture also carries a third, excluded setup row: neither
        // transport's count is thrown off by the setup method or by a stale
        // summary field.
        expect(syncResult.testsRan).toBe(2)
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
        // Arrange — two classes in the perimeter stay on the asynchronous transport
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
        expect(runTestSynchronousMock).not.toHaveBeenCalled()
      })

      it('then should count a Fail row toward otherFailureCount', async () => {
        // Arrange — a single class routes through the synchronous transport
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
        runTestSynchronousMock.mockResolvedValue(mockTestResult)
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
        expect(runTestAsynchronousMock).not.toHaveBeenCalled()
      })

      it('then should count a Skip row toward otherFailureCount', async () => {
        // Arrange — a single class routes through the synchronous transport
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
        runTestSynchronousMock.mockResolvedValue(mockTestResult)
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
        expect(runTestAsynchronousMock).not.toHaveBeenCalled()
      })

      it('then should dedupe CompileFail rows by folded class name and keep the first message', async () => {
        // Arrange — a single class routes through the synchronous transport
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
        runTestSynchronousMock.mockResolvedValue(mockTestResult)
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
        expect(runTestAsynchronousMock).not.toHaveBeenCalled()
      })

      it('then should normalise a null compile message to an empty string', async () => {
        // Arrange — a single class routes through the synchronous transport
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
        runTestSynchronousMock.mockResolvedValue(mockTestResult)
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
        expect(runTestAsynchronousMock).not.toHaveBeenCalled()
      })
    })

    describe('given a synchronous baseline carrying every compile-failure marker', () => {
      // Captured from a live org: a class made non-compiling by deleting a
      // dependency, run through the synchronous Tooling resource.
      const syncCompileFailureRow = {
        id: '01pdL00000Z2WSfQAN',
        apexClass: { fullName: 'AmtSyncDepTest' },
        methodName: null,
        outcome: ApexTestResultOutcome.Fail,
        message: 'line 5, column 37: Variable does not exist: AmtSyncDep',
        runTime: -1,
      }
      const syncCompileFailureResult = {
        summary: { outcome: 'Failed', passing: 0, failing: 1, testsRan: 0 },
        tests: [syncCompileFailureRow],
      }

      it('then should normalise the row to a CompileFail naming the class with the platform message', async () => {
        // Arrange — a single class routes through the synchronous transport
        runTestSynchronousMock.mockResolvedValue(syncCompileFailureResult)
        const strategyStub = {
          fidelity: 'aggregate' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          ['AmtSyncDepTest'],
          strategyStub
        )

        // Assert — reported as a compile failure, not an aborting test
        // failure, and the strategy never sees the non-executed row
        expect(result.compileFailures).toEqual([
          {
            className: 'AmtSyncDepTest',
            message: 'line 5, column 37: Variable does not exist: AmtSyncDep',
          },
        ])
        expect(result.otherFailureCount).toBe(0)
        expect(strategyStub.getTestMethodsPerLine).toHaveBeenCalledWith(
          expect.objectContaining({ tests: [] })
        )
      })

      it('then should set testsRan to the normalised row count instead of the raw zero', async () => {
        // Arrange — without this, assertUsableBaseline's second guard throws
        // 'No tests were executed!' before the compile diagnostic is ever seen
        runTestSynchronousMock.mockResolvedValue(syncCompileFailureResult)
        const strategyStub = {
          fidelity: 'aggregate' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          ['AmtSyncDepTest'],
          strategyStub
        )

        // Assert
        expect(result.testsRan).toBe(1)
      })
    })

    describe('given a synchronous result missing one compile-failure marker', () => {
      const markedRow = {
        id: '01pdL00000Z2WSfQAN',
        apexClass: { fullName: 'AmtSyncDepTest' },
        methodName: null,
        outcome: ApexTestResultOutcome.Fail,
        message: 'line 5, column 37: Variable does not exist: AmtSyncDep',
        runTime: -1,
      }
      const markedSummary = {
        outcome: 'Failed',
        passing: 0,
        failing: 1,
        testsRan: 0,
      }

      const runSyncBaseline = async (mockTestResult: {
        summary: unknown
        tests: unknown[]
      }) => {
        runTestSynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'aggregate' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }
        return sut.getTestMethodsPerLines(['AmtSyncDepTest'], strategyStub)
      }

      it('then should stay a plain Fail when methodName names a real method', async () => {
        // Act
        const result = await runSyncBaseline({
          summary: markedSummary,
          tests: [{ ...markedRow, methodName: 'someTestMethod' }],
        })

        // Assert — fails closed: not every marker matched, so it aborts
        expect(result.compileFailures).toEqual([])
        expect(result.otherFailureCount).toBe(1)
      })

      it('then should stay a plain Fail when runTime is not -1', async () => {
        // Act
        const result = await runSyncBaseline({
          summary: markedSummary,
          tests: [{ ...markedRow, runTime: 0.05 }],
        })

        // Assert
        expect(result.compileFailures).toEqual([])
        expect(result.otherFailureCount).toBe(1)
      })

      it('then should stay a plain Fail when summary.testsRan is not 0', async () => {
        // Act
        const result = await runSyncBaseline({
          summary: { ...markedSummary, testsRan: 1 },
          tests: [markedRow],
        })

        // Assert
        expect(result.compileFailures).toEqual([])
        expect(result.otherFailureCount).toBe(1)
      })

      it('then should stay a plain Fail when summary.failing is not 1', async () => {
        // Act
        const result = await runSyncBaseline({
          summary: { ...markedSummary, failing: 2 },
          tests: [markedRow],
        })

        // Assert
        expect(result.compileFailures).toEqual([])
        expect(result.otherFailureCount).toBe(1)
      })

      it('then should stay plain Fail rows when a second row also carries every marker', async () => {
        // Arrange — the fingerprint requires exactly one row
        const secondMarkedRow = {
          ...markedRow,
          apexClass: { fullName: 'AnotherSyncDepTest' },
        }

        // Act
        const result = await runSyncBaseline({
          summary: { ...markedSummary, failing: 2 },
          tests: [markedRow, secondMarkedRow],
        })

        // Assert — neither row is normalised
        expect(result.compileFailures).toEqual([])
        expect(result.otherFailureCount).toBe(2)
        expect(runTestAsynchronousMock).not.toHaveBeenCalled()
      })
    })

    describe('given an asynchronous result whose single row matches every compile-failure marker', () => {
      it('then should leave the row unnormalised because normalisation is scoped to the synchronous transport', async () => {
        // Arrange — two classes in the perimeter stay on the asynchronous
        // transport, even though this row happens to match every marker
        const asyncMatchingRow = {
          apexClass: { fullName: 'AmtSyncDepTest' },
          methodName: null,
          outcome: ApexTestResultOutcome.Fail,
          message: 'line 5, column 37: Variable does not exist: AmtSyncDep',
          runTime: -1,
        }
        const mockTestResult = {
          summary: { outcome: 'Failed', passing: 0, failing: 1, testsRan: 0 },
          tests: [asyncMatchingRow],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'per-test' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          ['AmtSyncDepTest', 'GoodTest'],
          strategyStub
        )

        // Assert
        expect(result.compileFailures).toEqual([])
        expect(result.otherFailureCount).toBe(1)
        expect(runTestSynchronousMock).not.toHaveBeenCalled()
      })
    })

    describe('given multiple test classes', () => {
      it('then should build one test entry per class in perimeter order', async () => {
        // Arrange — two classes stay on the asynchronous transport
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
        expect(runTestSynchronousMock).not.toHaveBeenCalled()
      })
    })

    describe('given the synchronous test execution throws', () => {
      it('then should fall back to the asynchronous transport preserving skipCodeCoverage: false', async () => {
        // Arrange — a single class prefers the synchronous transport, but it rejects
        runTestSynchronousMock.mockRejectedValue(
          new Error('View Setup permission required')
        )
        const mockTestResult = {
          summary: { outcome: 'Passed', passing: 1, failing: 0, testsRan: 1 },
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'per-test' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        await sut.getTestMethodsPerLines(['TestClass'], strategyStub)

        // Assert — the retry carries the same payload and the same coverage flag
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

      it('then should propagate the asynchronous error when the fallback also fails', async () => {
        // Arrange
        runTestSynchronousMock.mockRejectedValue(new Error('sync down'))
        const asyncError = new Error('Test execution failed')
        runTestAsynchronousMock.mockRejectedValue(asyncError)
        const strategyStub = {
          fidelity: 'per-test' as const,
          getTestMethodsPerLine: vi.fn(),
        }

        // Act & Assert — identity, not message equality: classifyError reads
        // properties off the propagated object itself.
        await expect(
          sut.getTestMethodsPerLines(['TestClass'], strategyStub)
        ).rejects.toBe(asyncError)
      })
    })
  })

  describe('when running tests', () => {
    describe('given the test execution is successful', () => {
      it('then should return the test result', async () => {
        // Arrange — a single-method, single-class id set routes through the
        // synchronous transport
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
          },
        }
        runTestSynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.runTestMethods(
          new Set<TestMethodId>(['TestClass.testMethod'])
        )

        // Assert — a single-class id set reproduces the byte-identical
        // single-element payload, with no `testLevel` key
        expect(result).toEqual(mockTestResult)
        expect(runTestSynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ className: 'TestClass', testMethods: ['testMethod'] }],
            skipCodeCoverage: true,
            maxFailedTests: 0,
          },
          false
        )
        expect(runTestAsynchronousMock).not.toHaveBeenCalled()
      })
    })

    describe('given a single-class id set spanning multiple methods', () => {
      it('then should fold every method into one synchronous test entry', async () => {
        // Arrange
        const mockTestResult = { summary: { outcome: 'Passed' } }
        runTestSynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        await sut.runTestMethods(new Set<TestMethodId>(['A.m1', 'A.m2']))

        // Assert
        expect(runTestSynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ className: 'A', testMethods: ['m1', 'm2'] }],
            skipCodeCoverage: true,
            maxFailedTests: 0,
          },
          false
        )
        expect(runTestAsynchronousMock).not.toHaveBeenCalled()
      })
    })

    describe('given a single-class id set with no method cap', () => {
      it('then should route every one of forty methods through the synchronous transport in one item', async () => {
        // Arrange
        const mockTestResult = { summary: { outcome: 'Passed' } }
        runTestSynchronousMock.mockResolvedValue(mockTestResult)
        const methodNames = Array.from(
          { length: 40 },
          (_, index) => `m${index + 1}`
        )
        const ids = methodNames.map(
          methodName => `A.${methodName}` as TestMethodId
        )

        // Act
        await sut.runTestMethods(new Set<TestMethodId>(ids))

        // Assert — there is no payload cap; every method travels in one item
        expect(runTestSynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ className: 'A', testMethods: methodNames }],
            skipCodeCoverage: true,
            maxFailedTests: 0,
          },
          false
        )
        expect(runTestAsynchronousMock).not.toHaveBeenCalled()
      })
    })

    describe('given a mixed-class id set', () => {
      it('then should fold the ids into one test entry per declaring class', async () => {
        // Arrange — two classes stay on the asynchronous transport
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
        expect(runTestSynchronousMock).not.toHaveBeenCalled()
      })
    })

    describe('given the synchronous test execution throws', () => {
      it('then should fall back to the asynchronous transport with the same payload and resolve with its result', async () => {
        // Arrange
        const syncError = new Error('View Setup permission required')
        runTestSynchronousMock.mockRejectedValue(syncError)
        const mockTestResult = { summary: { outcome: 'Passed' } }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.runTestMethods(
          new Set<TestMethodId>(['TestClass.testMethod'])
        )

        // Assert
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

      it('then should propagate the asynchronous error identity when the fallback also fails', async () => {
        // Arrange
        runTestSynchronousMock.mockRejectedValue(new Error('sync down'))
        const asyncError = new Error('Test execution failed')
        runTestAsynchronousMock.mockRejectedValue(asyncError)

        // Act & Assert
        await expect(
          sut.runTestMethods(new Set<TestMethodId>(['TestClass.testMethod']))
        ).rejects.toBe(asyncError)
      })

      it('then should report the fallback reason exactly once across two consecutive synchronous rejections', async () => {
        // Arrange — bounded to one retry per attempt, but reported only once
        // per adapter instance, however many groups hit it in the session.
        const onSyncFallback = vi.fn()
        const fallbackSut = new ApexTestRunner(connectionStub, {
          onSyncFallback,
        })
        runTestSynchronousMock.mockRejectedValue(
          new Error('View Setup permission required')
        )
        runTestAsynchronousMock.mockResolvedValue({
          summary: { outcome: 'Passed' },
        })

        // Act
        await fallbackSut.runTestMethods(
          new Set<TestMethodId>(['TestClass.testMethod'])
        )
        await fallbackSut.runTestMethods(
          new Set<TestMethodId>(['TestClass.testMethod'])
        )

        // Assert — both calls still fall back, the reason is reported once
        expect(onSyncFallback).toHaveBeenCalledTimes(1)
        expect(runTestAsynchronousMock).toHaveBeenCalledTimes(2)
      })

      it('then should normalise a non-Error rejection into an Error before reporting it', async () => {
        // Arrange
        const onSyncFallback = vi.fn()
        const fallbackSut = new ApexTestRunner(connectionStub, {
          onSyncFallback,
        })
        runTestSynchronousMock.mockRejectedValue('plain string rejection')
        runTestAsynchronousMock.mockResolvedValue({
          summary: { outcome: 'Passed' },
        })

        // Act
        await fallbackSut.runTestMethods(
          new Set<TestMethodId>(['TestClass.testMethod'])
        )

        // Assert
        expect(onSyncFallback).toHaveBeenCalledTimes(1)
        const [reportedError] = onSyncFallback.mock.calls[0] as [Error]
        expect(reportedError).toBeInstanceOf(Error)
        expect(reportedError.message).toBe('plain string rejection')
      })

      it('then should fall back without throwing when no callback is supplied', async () => {
        // Arrange — the shared sut is constructed with no onSyncFallback
        runTestSynchronousMock.mockRejectedValue(
          new Error('View Setup permission required')
        )
        runTestAsynchronousMock.mockResolvedValue({
          summary: { outcome: 'Passed' },
        })

        // Act & Assert
        await expect(
          sut.runTestMethods(new Set<TestMethodId>(['TestClass.testMethod']))
        ).resolves.toEqual({ summary: { outcome: 'Passed' } })
      })

      it('then should preserve the rejected Error object identity when reporting it', async () => {
        // Arrange — the non-Error branch was already pinned; this pins the
        // Error branch, which an unconditional `new Error(String(error))`
        // rewrite would also satisfy on message text alone while discarding
        // the original object's errorCode, name and stack.
        const onSyncFallback = vi.fn()
        const fallbackSut = new ApexTestRunner(connectionStub, {
          onSyncFallback,
        })
        const syncError = Object.assign(
          new Error('View Setup permission required'),
          { errorCode: 'INSUFFICIENT_ACCESS_OR_READONLY' }
        )
        runTestSynchronousMock.mockRejectedValue(syncError)
        runTestAsynchronousMock.mockResolvedValue({
          summary: { outcome: 'Passed' },
        })

        // Act
        await fallbackSut.runTestMethods(
          new Set<TestMethodId>(['TestClass.testMethod'])
        )

        // Assert — identity, not just message equality
        expect(onSyncFallback.mock.calls[0][0]).toBe(syncError)
      })

      it('then should still issue the asynchronous call when the fallback report throws', async () => {
        // Arrange — the reporting channel is entirely the caller's (it wraps
        // a stdout write in production), so a throw from it must not preempt
        // the asynchronous attempt: the async call is issued first, and
        // reporting happens only once it is already in flight.
        const reportingError = new Error('EPIPE')
        const onSyncFallback = vi.fn(() => {
          throw reportingError
        })
        const fallbackSut = new ApexTestRunner(connectionStub, {
          onSyncFallback,
        })
        runTestSynchronousMock.mockRejectedValue(
          new Error('View Setup permission required')
        )
        runTestAsynchronousMock.mockResolvedValue({
          summary: { outcome: 'Passed' },
        })

        // Act & Assert — the reporting error is not swallowed either
        await expect(
          fallbackSut.runTestMethods(
            new Set<TestMethodId>(['TestClass.testMethod'])
          )
        ).rejects.toBe(reportingError)
        expect(runTestAsynchronousMock).toHaveBeenCalledTimes(1)
      })
    })

    describe('given a permanent capability gap on the synchronous transport', () => {
      const permanentSyncError = Object.assign(
        new Error('View Setup permission required'),
        { errorCode: 'INSUFFICIENT_ACCESS_OR_READONLY' }
      )

      it('then should skip the synchronous attempt on every later single-class call in the same session', async () => {
        // Arrange — a capability gap (missing View Setup permission) cannot
        // resolve itself mid-campaign, so it costs exactly one wasted
        // round-trip rather than one per group.
        const fallbackSut = new ApexTestRunner(connectionStub, {})
        runTestSynchronousMock.mockRejectedValue(permanentSyncError)
        runTestAsynchronousMock.mockResolvedValue({
          summary: { outcome: 'Passed' },
        })

        // Act
        await fallbackSut.runTestMethods(
          new Set<TestMethodId>(['TestClass.testMethod'])
        )
        await fallbackSut.runTestMethods(
          new Set<TestMethodId>(['TestClass.testMethod'])
        )

        // Assert — one synchronous attempt total, two asynchronous ones
        expect(runTestSynchronousMock).toHaveBeenCalledTimes(1)
        expect(runTestAsynchronousMock).toHaveBeenCalledTimes(2)
      })

      it('then should keep retrying the synchronous transport on a transient error code', async () => {
        // Arrange — UNABLE_TO_LOCK_ROW is a contention error a later group
        // can recover from; it must not trip the permanent latch.
        const transientSyncError = Object.assign(
          new Error('unable to obtain exclusive access to this record'),
          { errorCode: 'UNABLE_TO_LOCK_ROW' }
        )
        const fallbackSut = new ApexTestRunner(connectionStub, {})
        runTestSynchronousMock.mockRejectedValue(transientSyncError)
        runTestAsynchronousMock.mockResolvedValue({
          summary: { outcome: 'Passed' },
        })

        // Act
        await fallbackSut.runTestMethods(
          new Set<TestMethodId>(['TestClass.testMethod'])
        )
        await fallbackSut.runTestMethods(
          new Set<TestMethodId>(['TestClass.testMethod'])
        )

        // Assert — both calls still attempt the synchronous transport first
        expect(runTestSynchronousMock).toHaveBeenCalledTimes(2)
        expect(runTestAsynchronousMock).toHaveBeenCalledTimes(2)
      })
    })
  })
})
