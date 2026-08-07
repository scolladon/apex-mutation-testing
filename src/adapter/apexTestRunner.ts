import { TestLevel, TestResult, TestService } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import type { CoverageStrategy } from '../service/coverageStrategy.js'
import { type TestMethodId, toTestItems } from '../type/TestMethodId.js'

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
    return {
      outcome: testResult.summary.outcome,
      testsRan: testResult.summary.testsRan,
      failing: testResult.summary.failing,
      testMethodsPerLine: coverageStrategy.getTestMethodsPerLine(testResult),
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
