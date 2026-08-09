import {
  type ApexTestResultData,
  ApexTestResultOutcome,
  type ApexTestSetupData,
  TestLevel,
  TestResult,
  TestService,
} from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import type { CoverageStrategy } from '../service/coverageStrategy.js'
import { type TestMethodId, toTestItems } from '../type/TestMethodId.js'

export interface BaselineCompileFailure {
  className: string
  message: string
}

export interface BaselineTestResult {
  outcome: string
  testsRan: number
  failing: number
  compileFailures: BaselineCompileFailure[]
  otherFailureCount: number
  testMethodsPerLine: Map<number, Set<TestMethodId>>
}

const recordCompileFailure = (
  compileFailuresByClass: Map<string, BaselineCompileFailure>,
  test: ApexTestResultData
): void => {
  const key = test.apexClass.fullName.toLowerCase()
  if (compileFailuresByClass.has(key)) return
  compileFailuresByClass.set(key, {
    className: test.apexClass.fullName,
    message: test.message ?? '',
  })
}

// Apex identifiers are case-insensitive, matching the class-name folding
// `recordCompileFailure` already uses for its own dedup key.
const testMethodIdentity = (className: string, methodName: string): string =>
  `${className}.${methodName}`.toLowerCase()

// A @TestSetup method cannot be re-run on its own, so it must never surface
// as an executable test. The synchronous transport never reports one as a
// row at all; the asynchronous transport reports it through
// `TestResult.setup` whenever the org's API version supports the
// distinction. Cross-referencing that array — rather than trusting a row's
// mere absence from `tests` — keeps the exclusion correct even if a row
// ever ended up in both places.
const setupIdentities = (setup: ApexTestSetupData[]): Set<string> =>
  new Set(
    setup.map(row => testMethodIdentity(row.apexClass.fullName, row.methodName))
  )

// One pass, one place: this is the only thing in the codebase that classifies
// a *baseline* test outcome into compile-fail vs. executed vs. ignored. Per-mutant
// attribution reads outcomes on a separate path — GroupExecutor.attributeOutcomes
// reads each test's `outcome` and falls back to `testResult.summary.outcome`
// (see src/service/groupExecutor.ts). A CompileFail row never ran a test
// method, so it is excluded from executedTests rather than counted as a
// failure. A @TestSetup row is excluded before that classification even
// runs: it never becomes a TestMethodId, never contributes coverage, and
// never adds to testsRan.
const partitionOutcomes = (
  tests: ApexTestResultData[],
  setup: ApexTestSetupData[] = []
): {
  compileFailures: BaselineCompileFailure[]
  otherFailureCount: number
  executedTests: ApexTestResultData[]
  testsRan: number
} => {
  const compileFailuresByClass = new Map<string, BaselineCompileFailure>()
  const executedTests: ApexTestResultData[] = []
  const setupIds = setupIdentities(setup)
  let otherFailureCount = 0
  let testsRan = 0

  for (const test of tests) {
    if (
      setupIds.has(testMethodIdentity(test.apexClass.fullName, test.methodName))
    ) {
      continue
    }
    testsRan++
    if (test.outcome === ApexTestResultOutcome.CompileFail) {
      recordCompileFailure(compileFailuresByClass, test)
      continue
    }
    if (test.outcome !== ApexTestResultOutcome.Pass) otherFailureCount++
    executedTests.push(test)
  }

  return {
    compileFailures: [...compileFailuresByClass.values()],
    otherFailureCount,
    executedTests,
    testsRan,
  }
}

const SYNC_COMPILE_FAILURE_RUN_TIME = -1
const SYNC_COMPILE_FAILURE_TESTS_RAN = 0
const SYNC_COMPILE_FAILURE_ROW_COUNT = 1
const ASYNC_COMPILE_METHOD_NAME = '<compile>' // the token the async path emits

// The synchronous Tooling resource never throws on a non-compiling test
// class and never reports a CompileFail outcome — apex-node maps the
// failure to a plain Fail row with no method name. Every marker below must
// match: getting this wrong in the permissive direction would silently
// reclassify a real test failure as a compile skip.
const isSyncCompileFailureFingerprint = (testResult: TestResult): boolean => {
  const tests = testResult.tests ?? []
  if (tests.length !== SYNC_COMPILE_FAILURE_ROW_COUNT) return false
  const [row] = tests
  return (
    row.methodName === null &&
    row.runTime === SYNC_COMPILE_FAILURE_RUN_TIME &&
    testResult.summary.testsRan === SYNC_COMPILE_FAILURE_TESTS_RAN &&
    // one failing row is the same invariant as the row-count check above
    testResult.summary.failing === SYNC_COMPILE_FAILURE_ROW_COUNT
  )
}

// Rewrites a fingerprint-matching result into the shape the async transport
// already produces for the same failure, so partitionOutcomes treats both
// transports identically. Anything not matching every marker is returned
// untouched — fail closed, never reclassify on a partial match. A
// CompileFail row is non-Pass either way, so a mutant run scores identically
// through either shape.
const normalizeSyncCompileFailure = (testResult: TestResult): TestResult => {
  if (!isSyncCompileFailureFingerprint(testResult)) return testResult
  const [row] = testResult.tests
  const tests = [
    {
      ...row,
      outcome: ApexTestResultOutcome.CompileFail,
      methodName: ASYNC_COMPILE_METHOD_NAME,
    },
  ]
  return {
    ...testResult,
    tests,
    summary: {
      ...testResult.summary,
      // summary.failing has no reader in src/; reset for shape parity with
      // the asynchronous CompileFail fixture only, not for any behaviour.
      // summary.testsRan is left as-is for the same reason — partitionOutcomes
      // derives testsRan from the row count directly and never reads it.
      failing: 0,
    },
  }
}

// module-local, not exported — keeps the class's public surface unchanged
type TestItems = { className: string; testMethods?: string[] }[]

// the synchronous Tooling resource accepts exactly one Apex class per payload
const SYNC_ELIGIBLE_TEST_CLASS_COUNT = 1
// stop the run at the first failure, on both transports
const MAX_FAILED_TESTS = 0

// module-local, not exported — keeps the class's public surface unchanged.
// The adapter reports that it fell back; the caller decides how that looks.
interface ApexTestRunnerOptions {
  onSyncFallback?: (error: Error) => void
}

export class ApexTestRunner {
  protected readonly testService: TestService
  private readonly onSyncFallback?: (error: Error) => void
  // Mutable instance state, deliberately: createAdapters() builds one runner
  // per run, so this latch is session-scoped and stops a permission-less org
  // from emitting the same warning once per test group.
  private syncFallbackReported = false

  constructor(connection: Connection, options: ApexTestRunnerOptions = {}) {
    this.testService = new TestService(connection)
    this.onSyncFallback = options.onSyncFallback
  }

  public async getTestMethodsPerLines(
    apexTestClassNames: string[],
    coverageStrategy: CoverageStrategy
  ): Promise<BaselineTestResult> {
    const testResult = await this.runTests(
      apexTestClassNames.map(className => ({ className })),
      false
    )
    const { compileFailures, otherFailureCount, executedTests, testsRan } =
      partitionOutcomes(testResult.tests ?? [], testResult.setup)
    return {
      outcome: testResult.summary.outcome,
      testsRan,
      failing: testResult.summary.failing,
      compileFailures,
      otherFailureCount,
      testMethodsPerLine: coverageStrategy.getTestMethodsPerLine({
        ...testResult,
        tests: executedTests,
      }),
    }
  }

  public async runTestMethods(testMethods: Set<TestMethodId>) {
    return this.runTests(toTestItems(testMethods), true)
  }

  private async runTests(
    tests: TestItems,
    skipCodeCoverage: boolean
  ): Promise<TestResult> {
    return tests.length === SYNC_ELIGIBLE_TEST_CLASS_COUNT
      ? this.runPreferringSync(tests, skipCodeCoverage)
      : this.runTestAsynchronous(tests, skipCodeCoverage)
  }

  // runTestsSynchronous requires the View Setup user permission, which the
  // asynchronous path never needed. A thrown sync error is reported once,
  // then the exact same payload is retried on the asynchronous transport —
  // bounded to one retry, and whatever the retry throws propagates untouched.
  private async runPreferringSync(
    tests: TestItems,
    skipCodeCoverage: boolean
  ): Promise<TestResult> {
    try {
      return await this.runTestSynchronous(tests, skipCodeCoverage)
    } catch (error: unknown) {
      this.reportSyncFallback(error)
      return this.runTestAsynchronous(tests, skipCodeCoverage)
    }
  }

  private reportSyncFallback(error: unknown): void {
    if (this.syncFallbackReported) return
    this.syncFallbackReported = true
    this.onSyncFallback?.(
      error instanceof Error ? error : new Error(String(error))
    )
  }

  private async runTestSynchronous(
    tests: TestItems,
    skipCodeCoverage: boolean
  ): Promise<TestResult> {
    const testResult = (await this.testService.runTestSynchronous(
      { tests, skipCodeCoverage, maxFailedTests: MAX_FAILED_TESTS },
      !skipCodeCoverage
    )) as TestResult
    return normalizeSyncCompileFailure(testResult)
  }

  private async runTestAsynchronous(
    tests: TestItems,
    skipCodeCoverage: boolean
  ): Promise<TestResult> {
    return (await this.testService.runTestAsynchronous(
      {
        tests,
        testLevel: TestLevel.RunSpecifiedTests,
        skipCodeCoverage,
        maxFailedTests: MAX_FAILED_TESTS,
      },
      !skipCodeCoverage
    )) as TestResult
  }
}
