import { TestLevel, TestResult, TestService } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'

export class ApexTestRunner {
  protected readonly testService: TestService
  constructor(connection: Connection) {
    this.testService = new TestService(connection)
  }

  public async getCoveredLines(testClassName: string) {
    const testResult = await this.runTestAsynchronous(testClassName, false)
    return new Set(
      testResult.codecoverage?.flatMap(coverage => coverage.coveredLines)
    )
  }

  public async run(testClassName: string) {
    return await this.runTestAsynchronous(testClassName)
  }

  private async runTestAsynchronous(
    testClassName: string,
    skipCodeCoverage: boolean = true
  ) {
    return (await this.testService.runTestAsynchronous(
      {
        tests: [{ className: testClassName }],
        testLevel: TestLevel.RunSpecifiedTests,
        skipCodeCoverage,
        maxFailedTests: 0,
      },
      !skipCodeCoverage
    )) as TestResult
  }
}
