import {
  type ApexTestResultData,
  ApexTestResultOutcome,
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

// One pass, one place: this is the only thing in the codebase that classifies
// a *baseline* test outcome into compile-fail vs. executed. Per-mutant
// attribution reads outcomes on a separate path — GroupExecutor.attributeOutcomes
// reads each test's `outcome` and falls back to `testResult.summary.outcome`
// (see src/service/groupExecutor.ts). A CompileFail row never ran a test
// method, so it is excluded from executedTests rather than counted as a
// failure.
const partitionOutcomes = (
  tests: ApexTestResultData[]
): {
  compileFailures: BaselineCompileFailure[]
  otherFailureCount: number
  executedTests: ApexTestResultData[]
} => {
  const compileFailuresByClass = new Map<string, BaselineCompileFailure>()
  const executedTests: ApexTestResultData[] = []
  let otherFailureCount = 0

  for (const test of tests) {
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
  }
}

// module-local, not exported — keeps the class's public surface unchanged
type TestItems = { className: string; testMethods?: string[] }[]

// the synchronous Tooling resource accepts exactly one Apex class per payload
const SYNC_ELIGIBLE_TEST_CLASS_COUNT = 1
// stop the run at the first failure, on both transports
const MAX_FAILED_TESTS = 0

export class ApexTestRunner {
  protected readonly testService: TestService
  constructor(connection: Connection) {
    this.testService = new TestService(connection)
  }

  public async getTestMethodsPerLines(
    apexTestClassNames: string[],
    coverageStrategy: CoverageStrategy
  ): Promise<BaselineTestResult> {
    const testResult = await this.runTests(
      apexTestClassNames.map(className => ({ className })),
      false
    )
    const { compileFailures, otherFailureCount, executedTests } =
      partitionOutcomes(testResult.tests ?? [])
    return {
      outcome: testResult.summary.outcome,
      testsRan: testResult.summary.testsRan,
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
      ? this.runTestSynchronous(tests, skipCodeCoverage)
      : this.runTestAsynchronous(tests, skipCodeCoverage)
  }

  private async runTestSynchronous(
    tests: TestItems,
    skipCodeCoverage: boolean
  ): Promise<TestResult> {
    return (await this.testService.runTestSynchronous(
      { tests, skipCodeCoverage, maxFailedTests: MAX_FAILED_TESTS },
      !skipCodeCoverage
    )) as TestResult
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
