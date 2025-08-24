import { TestLevel, TestResult, TestService } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'

export class ApexTestRunner {
  protected readonly testService: TestService
  constructor(connection: Connection) {
    this.testService = new TestService(connection)
  }

  public async getTestMethodsPerLines(className: string) {
    const testResult = await this.runTestAsynchronous({ className }, false)

    const testMethodsPerLine = new Map<number, Set<string>>()

    testResult.tests?.forEach(test => {
      test.perClassCoverage?.forEach(testMethodExecutionResult => {
        testMethodExecutionResult.coverage?.coveredLines?.forEach(line => {
          if (!testMethodsPerLine.has(line)) {
            testMethodsPerLine.set(line, new Set<string>())
          }
          testMethodsPerLine
            .get(line)!
            .add(testMethodExecutionResult.apexTestMethodName)
        })
      })
    })

    return {
      outcome: testResult.summary.outcome,
      testsRan: testResult.summary.testsRan,
      failing: testResult.summary.failing,
      testMethodsPerLine,
    }
  }

  public async runTestMethods(
    className: string,
    testMethods: Set<string> = new Set<string>()
  ) {
    return await this.runTestAsynchronous({
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
