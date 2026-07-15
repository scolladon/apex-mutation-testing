import { TestLevel, TestResult, TestService } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import type { CoverageStrategy } from '../service/coverageStrategy.js'

export class ApexTestRunner {
  protected readonly testService: TestService
  constructor(connection: Connection) {
    this.testService = new TestService(connection)
  }

  public async getTestMethodsPerLines(
    apexTestClassName: string,
    coverageStrategy: CoverageStrategy
  ) {
    const testResult = await this.runTestAsynchronous(
      { className: apexTestClassName },
      false
    )
    return {
      outcome: testResult.summary.outcome,
      testsRan: testResult.summary.testsRan,
      failing: testResult.summary.failing,
      testMethodsPerLine: coverageStrategy.getTestMethodsPerLine(testResult),
    }
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
