import { ApexTestResultOutcome, TestLevel } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import { ApexTestRunner } from '../../../../src/adapter/org/apexTestRunner.js'
import type { TestMethodId } from '../../../../src/type/TestMethodId.js'

const runTestAsynchronousMock = vi.fn()
const runTestSynchronousMock = vi.fn()

// Pinned live on a namespaced org: the covered class under mutation and the
// test class exercising it, each an 18-character org Id.
const TARGET_CLASS_ID = '01pjV000000EE9ZQAW'
const TEST_CLASS_ID = '01pjV000000EE9bQAG'
// Pinned live on a namespaced org: `apexClass.fullName` reported
// `namespaced.ProbeFailTest` on a Pass row and `namespaced__ProbeFailTest`
// on a Fail row for the same class, while `apexClass.id` and `apexClass.name`
// stayed identical on both.
const PROBE_CLASS_ID = '01pjV000000GlEHQA0'

// Mirrors ApexTestRunner's own SDK-DTO-to-domain mapping, so an assertion on
// what the adapter hands the injected coverage strategy stays in lockstep
// with a raw SDK row fixture without duplicating the mapping by hand.
const mappedCoverage = (row: {
  apexClassOrTriggerId: string
  apexClassOrTriggerName: string
  apexTestMethodName: string
  coverage?: { coveredLines: number[] }
}) => ({
  classId: row.apexClassOrTriggerId,
  testMethodName: row.apexTestMethodName,
  detail: row.coverage && { coveredLines: row.coverage.coveredLines },
})

const mappedTest = (row: {
  apexClass: { id: string; name: string }
  methodName: string | null
  outcome: string
  perClassCoverage?: Array<{
    apexClassOrTriggerId: string
    apexClassOrTriggerName: string
    apexTestMethodName: string
    coverage?: { coveredLines: number[] }
  }>
}) => ({
  classId: row.apexClass.id,
  methodName: row.methodName,
  outcome: row.outcome,
  coverage: row.perClassCoverage?.map(mappedCoverage),
})

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

  describe('class identity vs display name', () => {
    describe('given a Fail row whose fullName spelling differs from its Pass-row sibling', () => {
      it('then should read classId from the id, never from fullName', async () => {
        // Arrange — the id, the bare name and fullName all differ from one
        // another, so this fixture can tell the new mechanism apart from
        // the one it replaces
        const failRow = {
          apexClass: {
            id: PROBE_CLASS_ID,
            name: 'ProbeFailTest',
            namespacePrefix: 'namespaced',
            fullName: 'namespaced__ProbeFailTest',
          },
          methodName: 'failsOnPurpose',
          outcome: ApexTestResultOutcome.Fail,
          message: null,
        }
        const mockTestResult = {
          summary: { outcome: 'Failed', passing: 0, failing: 1, testsRan: 1 },
          tests: [failRow],
        }
        runTestSynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'per-test' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        await sut.getTestMethodsPerLines(['ProbeFailTest'], strategyStub)

        // Assert
        expect(strategyStub.getTestMethodsPerLine).toHaveBeenCalledWith(
          expect.objectContaining({ tests: [mappedTest(failRow)] })
        )
      })
    })

    describe('given the same class reported across a Pass row and a Fail row with different fullName spellings', () => {
      it('then should map both rows to the identical classId', async () => {
        // Arrange — apex-node's synchronous transport picks its namespace
        // separator by outcome, so fullName varies per row for one class;
        // classId must not
        const passRow = {
          apexClass: {
            id: PROBE_CLASS_ID,
            name: 'ProbeFailTest',
            namespacePrefix: 'namespaced',
            fullName: 'namespaced.ProbeFailTest',
          },
          methodName: 'passes',
          outcome: ApexTestResultOutcome.Pass,
          message: null,
        }
        const failRow = {
          apexClass: {
            id: PROBE_CLASS_ID,
            name: 'ProbeFailTest',
            namespacePrefix: 'namespaced',
            fullName: 'namespaced__ProbeFailTest',
          },
          methodName: 'fails',
          outcome: ApexTestResultOutcome.Fail,
          message: null,
        }
        const mockTestResult = {
          summary: { outcome: 'Failed', passing: 1, failing: 1, testsRan: 2 },
          tests: [passRow, failRow],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'aggregate' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        await sut.getTestMethodsPerLines(
          ['ProbeFailTest', 'Other'],
          strategyStub
        )

        // Assert
        expect(strategyStub.getTestMethodsPerLine).toHaveBeenCalledWith(
          expect.objectContaining({
            tests: [mappedTest(passRow), mappedTest(failRow)],
          })
        )
      })
    })

    describe('given two CompileFail rows for one class whose fullName spelling differs by outcome but whose apexClass.id agrees', () => {
      it('then should dedupe into one BaselineCompileFailure carrying the classId', async () => {
        // Arrange — a two-class perimeter stays on the asynchronous
        // transport
        const firstCompileRow = {
          apexClass: {
            id: PROBE_CLASS_ID,
            name: 'ProbeFailTest',
            namespacePrefix: 'namespaced',
            fullName: 'namespaced.ProbeFailTest',
          },
          methodName: '<compile>',
          outcome: ApexTestResultOutcome.CompileFail,
          message: 'first diagnosis',
        }
        const secondCompileRow = {
          apexClass: {
            id: PROBE_CLASS_ID,
            name: 'ProbeFailTest',
            namespacePrefix: 'namespaced',
            fullName: 'namespaced__ProbeFailTest',
          },
          methodName: '<compile>',
          outcome: ApexTestResultOutcome.CompileFail,
          message: 'second diagnosis',
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
          ['ProbeFailTest', 'Other'],
          strategyStub
        )

        // Assert
        expect(result.compileFailures).toEqual([
          {
            classId: PROBE_CLASS_ID,
            message: 'first diagnosis',
          },
        ])
      })
    })

    describe('given a TestSetup row and a tests row for the same class reported with a differently spelled fullName', () => {
      it('then should exclude the setup row by matching classId', async () => {
        // Arrange — a two-class perimeter stays on the asynchronous
        // transport
        const setupRow = {
          apexClass: {
            id: TEST_CLASS_ID,
            name: 'MutationTest',
            namespacePrefix: 'namespaced',
            fullName: 'namespaced.MutationTest',
          },
          methodName: 'setup',
          outcome: ApexTestResultOutcome.Pass,
          message: null,
        }
        const setupEntry = {
          apexClass: {
            id: TEST_CLASS_ID,
            name: 'MutationTest',
            namespacePrefix: 'namespaced',
            fullName: 'namespaced__MutationTest',
          },
          methodName: 'setup',
          testSetupTime: 12,
        }
        const otherRow = {
          apexClass: { id: 'OtherId', name: 'Other' },
          methodName: 'itWorks',
          outcome: ApexTestResultOutcome.Pass,
          message: null,
        }
        const mockTestResult = {
          summary: { outcome: 'Passed', passing: 2, failing: 0, testsRan: 2 },
          tests: [setupRow, otherRow],
          setup: [setupEntry],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'aggregate' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          ['MutationTest', 'Other'],
          strategyStub
        )

        // Assert
        expect(result.testsRan).toBe(1)
      })
    })

    describe('given PerClassCoverage and CodeCoverageResult rows for the covered class', () => {
      it('then should map both to carry classId', async () => {
        // Arrange — a single class routes through the synchronous transport
        const passRow = {
          apexClass: { id: TEST_CLASS_ID, name: 'MutationTest' },
          methodName: 'testMethodA',
          outcome: ApexTestResultOutcome.Pass,
          message: null,
          perClassCoverage: [
            {
              apexClassOrTriggerId: TARGET_CLASS_ID,
              apexClassOrTriggerName: 'Mutation',
              apexTestMethodName: 'testMethodA',
              coverage: { coveredLines: [1] },
            },
          ],
        }
        const mockTestResult = {
          summary: { outcome: 'Passed', passing: 1, failing: 0, testsRan: 1 },
          tests: [passRow],
          codecoverage: [
            { apexId: TARGET_CLASS_ID, name: 'Mutation', coveredLines: [1] },
          ],
        }
        runTestSynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'per-test' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        await sut.getTestMethodsPerLines(['MutationTest'], strategyStub)

        // Assert
        expect(strategyStub.getTestMethodsPerLine).toHaveBeenCalledWith({
          outcome: mockTestResult.summary.outcome,
          tests: [mappedTest(passRow)],
          classCoverage: [
            {
              classId: TARGET_CLASS_ID,
              coveredLines: [1],
            },
          ],
        })
      })
    })
  })

  describe('when getting covered lines', () => {
    describe('given the test execution is successful', () => {
      it('then should delegate coverage shaping to the injected strategy and return the trimmed result', async () => {
        // Arrange
        const passRow = {
          apexClass: { id: 'TestClassId', name: 'TestClass' },
          methodName: 'testMethodA',
          outcome: ApexTestResultOutcome.Pass,
          message: null,
          perClassCoverage: [
            {
              apexClassOrTriggerId: 'TestClassId',
              apexClassOrTriggerName: 'TestClass',
              apexTestMethodName: 'testMethodA',
              // uncoveredLines is real SDK shape the adapter must trim away —
              // a coverage fixture with no other field could not tell a
              // dropped field apart from an unwrapped passthrough.
              coverage: { coveredLines: [1], uncoveredLines: [2, 3] },
            },
          ],
        }
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 1,
            failing: 0,
            testsRan: 1,
          },
          tests: [passRow],
          codecoverage: [
            { apexId: 'TestClassId', name: 'TestClass', coveredLines: [1] },
          ],
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
          compileFailures: [],
          otherFailureCount: 0,
          testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
        })
        expect(strategyStub.getTestMethodsPerLine).toHaveBeenCalledWith({
          outcome: mockTestResult.summary.outcome,
          tests: [mappedTest(passRow)],
          classCoverage: [
            {
              classId: 'TestClassId',
              coveredLines: [1],
            },
          ],
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
      const setupTestClass = { id: 'AmtSetupTestId', name: 'AmtSetupTest' }
      const firstRealRow = {
        apexClass: setupTestClass,
        methodName: 'itDoesSomething',
        outcome: ApexTestResultOutcome.Pass,
        message: null,
      }
      const secondRealRow = {
        apexClass: { id: 'OtherTestId', name: 'OtherTest' },
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
          outcome: mockTestResult.summary.outcome,
          tests: [mappedTest(firstRealRow), mappedTest(secondRealRow)],
        })
      })

      it('then should exclude a row appearing in both tests and setup, matching identity by class id even when the reported display name differs', async () => {
        // Arrange — defends against a row surfacing in both places: cross-
        // referencing TestResult.setup rather than trusting a row's mere
        // absence from `tests` keeps the exclusion correct regardless of the
        // org's API version or any SDK quirk that leaves a setup row mixed
        // into `tests`. The duplicate carries the same class id as
        // setupEntry but a differently-cased display name, proving the join
        // ignores the name entirely.
        const duplicatedSetupRow = {
          apexClass: { id: 'AmtSetupTestId', name: 'amtsetuptest' },
          methodName: 'setUpData',
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
          outcome: mockTestResult.summary.outcome,
          tests: [mappedTest(firstRealRow), mappedTest(secondRealRow)],
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
        apexClass: { id: 'BrokenTestId', name: 'BrokenTest' },
        methodName: '<compile>',
        outcome: ApexTestResultOutcome.CompileFail,
        message: 'Invalid type: AmtProbeDep at line 3 column 5',
      }
      const passRow = {
        apexClass: { id: 'GoodTestId', name: 'GoodTest' },
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
            classId: 'BrokenTestId',
            message: 'Invalid type: AmtProbeDep at line 3 column 5',
          },
        ])
        expect(result.otherFailureCount).toBe(0)
        expect(strategyStub.getTestMethodsPerLine).toHaveBeenCalledWith({
          outcome: mockTestResult.summary.outcome,
          tests: [mappedTest(passRow)],
        })
        expect(runTestSynchronousMock).not.toHaveBeenCalled()
      })

      it('then should count a Fail row toward otherFailureCount', async () => {
        // Arrange — a single class routes through the synchronous transport
        const failRow = {
          apexClass: { id: 'FlakyTestId', name: 'FlakyTest' },
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
          apexClass: { id: 'SkippedTestId', name: 'SkippedTest' },
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

      it('then should dedupe CompileFail rows by class id and keep the first message', async () => {
        // Arrange — a single class routes through the synchronous transport;
        // both rows report the identical class id, as a retried compile
        // attempt for the same class would
        const firstCompileRow = {
          apexClass: { id: 'BrokenTestId', name: 'BrokenTest' },
          methodName: '<compile>',
          outcome: ApexTestResultOutcome.CompileFail,
          message: 'Invalid type: AmtProbeDep at line 3 column 5',
        }
        const secondCompileRow = {
          apexClass: { id: 'BrokenTestId', name: 'BrokenTest' },
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
            classId: 'BrokenTestId',
            message: 'Invalid type: AmtProbeDep at line 3 column 5',
          },
        ])
        expect(runTestAsynchronousMock).not.toHaveBeenCalled()
      })

      it('then should keep both CompileFail rows when they share a name but carry different class ids', async () => {
        // Arrange — a local class and a mockery.-prefixed class can share
        // the same bare name while remaining two distinct classes; only the
        // class id may fold them together, never the name. A fixture where
        // both rows shared the same id (as the dedupe test above does) could
        // not tell a name-keyed dedupe apart from an id-keyed one — this one
        // can, since dedupe-by-name would wrongly collapse it to one entry.
        const localCompileRow = {
          apexClass: { id: 'LocalArgumentId', name: 'Argument' },
          methodName: '<compile>',
          outcome: ApexTestResultOutcome.CompileFail,
          message: 'Invalid type: LocalDep at line 3 column 5',
        }
        const packagedCompileRow = {
          apexClass: { id: 'PackagedArgumentId', name: 'Argument' },
          methodName: '<compile>',
          outcome: ApexTestResultOutcome.CompileFail,
          message: 'Invalid type: PackagedDep at line 7 column 1',
        }
        const mockTestResult = {
          summary: { outcome: 'Failed', passing: 0, failing: 0, testsRan: 2 },
          tests: [localCompileRow, packagedCompileRow],
        }
        runTestSynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'aggregate' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          ['Argument'],
          strategyStub
        )

        // Assert — two distinct diagnoses survive, one per class id
        expect(result.compileFailures).toEqual([
          {
            classId: 'LocalArgumentId',
            message: 'Invalid type: LocalDep at line 3 column 5',
          },
          {
            classId: 'PackagedArgumentId',
            message: 'Invalid type: PackagedDep at line 7 column 1',
          },
        ])
        expect(runTestAsynchronousMock).not.toHaveBeenCalled()
      })

      it('then should normalise a null compile message to an empty string', async () => {
        // Arrange — a single class routes through the synchronous transport
        const compileRowWithoutMessage = {
          apexClass: { id: 'BrokenTestId', name: 'BrokenTest' },
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
          { classId: 'BrokenTestId', message: '' },
        ])
        expect(runTestAsynchronousMock).not.toHaveBeenCalled()
      })
    })

    describe('given a synchronous baseline carrying every compile-failure marker', () => {
      // Captured from a live org against @salesforce/apex-node@9.0.2: a
      // class made non-compiling by deleting a dependency, run through the
      // synchronous Tooling resource. `methodName: null` is impossible per
      // the SDK's `ApexTestResultData.methodName: string` type — this is
      // the actual runtime shape, not a typo; there is no automated drift
      // detector, so re-verify against a live org if this ever needs to
      // change. `apexClass.id` is a fabricated 18-character org Id, since
      // it was not the field under test when this row was captured.
      const syncCompileFailureRow = {
        id: '01pdL00000Z2WSfQAN',
        apexClass: { id: '01pdL00000Z2WqmQAF', name: 'AmtSyncDepTest' },
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
            classId: '01pdL00000Z2WqmQAF',
            message: 'line 5, column 37: Variable does not exist: AmtSyncDep',
          },
        ])
        expect(result.otherFailureCount).toBe(0)
        // The reshaped summary must still carry the org-reported outcome —
        // only `failing` is normalised away for shape parity with the
        // asynchronous fixture, every other summary field survives.
        expect(result.outcome).toBe('Failed')
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
        apexClass: { id: '01pdL00000Z2WqmQAF', name: 'AmtSyncDepTest' },
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
          apexClass: { id: '01pdL00000Z2WrAQAV', name: 'AnotherSyncDepTest' },
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

      it('then should stay plain Fail rows when a second row is present even though summary.failing alone already matches the fingerprint', async () => {
        // Arrange — unlike the fixture above (failing: 2, which the
        // `failing` conjunct alone already rejects regardless of row count),
        // this keeps failing: 1 so only the row-count conjunct can reject a
        // two-row result. Relaxing `tests.length !== 1` to `< 1` would let
        // this fingerprint match, collapsing both rows into a single
        // CompileFail and silently discarding the second one.
        const secondRow = {
          apexClass: { id: '01pdL00000Z2WsBQAV', name: 'OtherSyncDepTest' },
          methodName: 'itFails',
          outcome: ApexTestResultOutcome.Fail,
          message: 'System.AssertException: Assertion Failed',
          runTime: 0.02,
        }

        // Act
        const result = await runSyncBaseline({
          summary: markedSummary,
          tests: [markedRow, secondRow],
        })

        // Assert — neither row is normalised
        expect(result.compileFailures).toEqual([])
        expect(result.otherFailureCount).toBe(2)
      })
    })

    describe('given an asynchronous result whose single row matches every compile-failure marker', () => {
      it('then should leave the row unnormalised because normalisation is scoped to the synchronous transport', async () => {
        // Arrange — two classes in the perimeter stay on the asynchronous
        // transport, even though this row happens to match every marker
        const asyncMatchingRow = {
          apexClass: { id: '01pdL00000Z2WqmQAF', name: 'AmtSyncDepTest' },
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
        expect(result).toEqual({ outcome: 'Passed', tests: [] })
        expect(runTestSynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ classId: 'TestClass', testMethods: ['testMethod'] }],
            skipCodeCoverage: true,
            maxFailedTests: 0,
          },
          false
        )
        expect(runTestAsynchronousMock).not.toHaveBeenCalled()
      })
    })

    describe('given a synchronous single-class result matching the compile-failure fingerprint', () => {
      it('then should surface the normalised row carrying the async transport token as its method name', async () => {
        // Arrange
        const syncCompileFailureRow = {
          apexClass: { id: PROBE_CLASS_ID, name: 'AmtSyncDepTest' },
          methodName: null,
          outcome: ApexTestResultOutcome.Fail,
          message: 'line 5, column 37: Variable does not exist: AmtSyncDep',
          runTime: -1,
        }
        runTestSynchronousMock.mockResolvedValue({
          summary: { outcome: 'Failed', passing: 0, failing: 1, testsRan: 0 },
          tests: [syncCompileFailureRow],
        })

        // Act
        const result = await sut.runTestMethods(
          new Set<TestMethodId>(['AmtSyncDepTest.someMethod'])
        )

        // Assert — the sync transport's methodName: null marker is rewritten
        // to the same token the async transport emits for a compile failure.
        expect(result.tests).toEqual([
          mappedTest({
            ...syncCompileFailureRow,
            methodName: '<compile>',
            outcome: ApexTestResultOutcome.CompileFail,
          }),
        ])
      })
    })

    describe('given a single-class id set spanning multiple methods', () => {
      it('then should fold every method into one synchronous test entry', async () => {
        // Arrange — no payload cap: every method travels in one item,
        // however many there are.
        const mockTestResult = { summary: { outcome: 'Passed' } }
        runTestSynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        await sut.runTestMethods(new Set<TestMethodId>(['A.m1', 'A.m2']))

        // Assert
        expect(runTestSynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ classId: 'A', testMethods: ['m1', 'm2'] }],
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
              { classId: 'A', testMethods: ['testOne', 'testTwo'] },
              { classId: 'B', testMethods: ['testThree'] },
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

    describe('given an empty test method set', () => {
      it('then should route through the asynchronous transport with an empty payload', async () => {
        // Arrange — the zero boundary of the transport predicate: 0 must not
        // satisfy `tests.length === SYNC_ELIGIBLE_TEST_CLASS_COUNT`. Relaxing
        // `===` to `<=` would route an empty payload to the synchronous
        // transport instead.
        const mockTestResult = { summary: { outcome: 'Passed' } }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        await sut.runTestMethods(new Set<TestMethodId>())

        // Assert
        expect(runTestAsynchronousMock).toHaveBeenCalledWith(
          {
            tests: [],
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
        expect(result).toEqual({ outcome: 'Passed', tests: [] })
        expect(runTestAsynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ classId: 'TestClass', testMethods: ['testMethod'] }],
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

      it('then should fall back gracefully rather than throwing a TypeError when the rejection is null', async () => {
        // Arrange — a null rejection must not reach the permanent-failure
        // classification unguarded: readErrorCode reads a property off the
        // normalised Error toReportableError produces, never off the raw
        // rejection, so `null.errorCode` never has a chance to throw.
        const onSyncFallback = vi.fn()
        const fallbackSut = new ApexTestRunner(connectionStub, {
          onSyncFallback,
        })
        runTestSynchronousMock.mockRejectedValue(null)
        const mockTestResult = { summary: { outcome: 'Passed' } }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act & Assert — resolves via the asynchronous fallback, no throw
        await expect(
          fallbackSut.runTestMethods(
            new Set<TestMethodId>(['TestClass.testMethod'])
          )
        ).resolves.toEqual({ outcome: 'Passed', tests: [] })
        expect(onSyncFallback).toHaveBeenCalledTimes(1)
        const [reportedError] = onSyncFallback.mock.calls[0] as [Error]
        expect(reportedError).toBeInstanceOf(Error)
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
        ).resolves.toEqual({ outcome: 'Passed', tests: [] })
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

      it('then should not leave the fallback promise unhandled when the reporter throws and the asynchronous retry also rejects', async () => {
        // Arrange — the two failure modes are correlated, not independent:
        // the org/network trouble that broke the synchronous call is the
        // same condition most likely to also break the asynchronous retry.
        // A `fallback` promise created but never given a handler before the
        // reporter throws would surface as a Node `unhandledRejection` and,
        // under the default `--unhandled-rejections=throw`, terminate the
        // process. A process-wide listener is the only vantage point that
        // can observe that absence of a handler.
        const capturedRejections: unknown[] = []
        const onUnhandledRejection = (reason: unknown): void => {
          capturedRejections.push(reason)
        }
        process.on('unhandledRejection', onUnhandledRejection)

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
        const asyncError = new Error('Test execution failed')
        runTestAsynchronousMock.mockRejectedValue(asyncError)

        try {
          // Act — the reporter's own throw is still what the caller
          // observes, exactly as the sibling test above pins; the
          // asynchronous retry's rejection must be handled quietly rather
          // than crash the process.
          await expect(
            fallbackSut.runTestMethods(
              new Set<TestMethodId>(['TestClass.testMethod'])
            )
          ).rejects.toBe(reportingError)
          expect(runTestAsynchronousMock).toHaveBeenCalledTimes(1)

          // Assert — give Node's rejection tracking a turn of the event
          // loop; an unhandled `fallback` would have surfaced by now.
          await new Promise(resolve => setImmediate(resolve))
          expect(capturedRejections).toEqual([])
        } finally {
          process.off('unhandledRejection', onUnhandledRejection)
        }
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

      it('then should also latch on the sibling permanent error code', async () => {
        // Arrange — PERMANENT_SYNC_ERROR_CODES carries two codes; the
        // capability-gap test above only exercises the first
        // (INSUFFICIENT_ACCESS_OR_READONLY). This pins the second.
        const siblingPermanentError = Object.assign(
          new Error('Insufficient access rights'),
          { errorCode: 'INSUFFICIENT_ACCESS' }
        )
        const fallbackSut = new ApexTestRunner(connectionStub, {})
        runTestSynchronousMock.mockRejectedValue(siblingPermanentError)
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
