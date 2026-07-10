import { TestLevel, TestResult, TestService } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'

export class ApexTestRunner {
  protected readonly testService: TestService
  constructor(connection: Connection) {
    this.testService = new TestService(connection)
  }

  public async getTestMethodsPerLines(
    apexTestClassName: string,
    apexClassName: string
  ) {
    const testResult = await this.runTestAsynchronous(
      { className: apexTestClassName },
      false
    )

    const testMethodsPerLine = this.buildPerTestCoverage(
      testResult,
      apexClassName
    )

    // When "Store Only Aggregated Code Coverage" is checked on the org
    // (Setup > Apex Test Execution > Options), the `ApexCodeCoverage` object
    // and its `perClassCoverage` field are never populated.
    // apex-node still queries `ApexCodeCoverageAggregate` and exposes it as
    // `testResult.codecoverage` - use that instead when per-test data is missing.
    let aggregatedCoverageOnly = false
    if (testMethodsPerLine.size === 0) {
      const aggregateCoverage = this.buildAggregateCoverage(
        testResult,
        apexClassName
      )
      aggregatedCoverageOnly = aggregateCoverage.size > 0
      aggregateCoverage.forEach((testMethods, line) =>
        testMethodsPerLine.set(line, testMethods)
      )
    }

    return {
      outcome: testResult.summary.outcome,
      testsRan: testResult.summary.testsRan,
      failing: testResult.summary.failing,
      testMethodsPerLine,
      aggregatedCoverageOnly,
    }
  }

  private buildPerTestCoverage(
    testResult: TestResult,
    apexClassName: string
  ): Map<number, Set<string>> {
    const testMethodsPerLine = new Map<number, Set<string>>()
    testResult.tests?.forEach(test => {
      test.perClassCoverage
        ?.filter(coverage => coverage.apexClassOrTriggerName === apexClassName)
        .forEach(coverage => {
          coverage.coverage?.coveredLines?.forEach(line => {
            const testMethods = testMethodsPerLine.get(line) ?? new Set()
            testMethods.add(coverage.apexTestMethodName)
            testMethodsPerLine.set(line, testMethods)
          })
        })
    })
    return testMethodsPerLine
  }

  private buildAggregateCoverage(
    testResult: TestResult,
    apexClassName: string
  ): Map<number, Set<string>> {
    const testMethodNames = new Set(
      testResult.tests?.map(test => test.methodName) ?? []
    )
    const aggregateCoverage = testResult.codecoverage?.find(
      coverage => coverage.name === apexClassName
    )

    const testMethodsPerLine = new Map<number, Set<string>>()
    aggregateCoverage?.coveredLines?.forEach(line =>
      testMethodsPerLine.set(line, new Set(testMethodNames))
    )
    return testMethodsPerLine
  }

  public async runTestMethods(
    className: string,
    testMethods: Set<string> = new Set<string>()
  ) {
    return this.runTestAsynchronous({
      className,
      testMethods: Array.from(testMethods),
    })
  }

  private async runTestAsynchronous(
    testPerimeter: { className: string; testMethods?: string[] },
    skipCodeCoverage: boolean = true
  ) {
    return (await this.testService.runTestAsynchronous(
      {
        tests: [testPerimeter],
        testLevel: TestLevel.RunSpecifiedTests,
        skipCodeCoverage,
        maxFailedTests: 0,
      },
      !skipCodeCoverage
    )) as TestResult
  }
}
