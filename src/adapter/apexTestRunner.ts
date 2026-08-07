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

// One pass, one place: this is the only thing in the codebase that reads a
// test outcome. A CompileFail row never ran a test method, so it is excluded
// from executedTests rather than counted as a failure.
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

export class ApexTestRunner {
  protected readonly testService: TestService
  constructor(connection: Connection) {
    this.testService = new TestService(connection)
  }

  public async getTestMethodsPerLines(
    apexTestClassNames: string[],
    coverageStrategy: CoverageStrategy
  ) {
    const testResult = await this.runTestAsynchronous(
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
    return this.runTestAsynchronous(toTestItems(testMethods))
  }

  private async runTestAsynchronous(
    tests: { className: string; testMethods?: string[] }[],
    skipCodeCoverage: boolean = true
  ) {
    return (await this.testService.runTestAsynchronous(
      {
        tests,
        testLevel: TestLevel.RunSpecifiedTests,
        skipCodeCoverage,
        maxFailedTests: 0,
      },
      !skipCodeCoverage
    )) as TestResult
  }
}
