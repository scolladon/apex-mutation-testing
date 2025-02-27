import { TestLevel, TestResult, TestService } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'

export class ApexTestRunner {
  protected readonly testService: TestService
  constructor(connection: Connection) {
    this.testService = new TestService(connection)
  }

  public async run(className: string) {
    return (await this.testService.runTestAsynchronous({
      tests: [{ className }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: true,
      maxFailedTests: 0,
    })) as TestResult
  }
}
