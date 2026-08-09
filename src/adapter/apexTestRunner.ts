import { TestLevel, TestResult, TestService } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import { AerAdapter, AerWatchRunner } from './aerAdapter.js'

export class ApexTestRunner {
  protected readonly testService: TestService | undefined
  private readonly aerWatchRunner: AerWatchRunner | undefined

  constructor(
    connection: Connection | undefined,
    private readonly useAer = false,
    private readonly aerSfProjectPath?: string,
    private readonly apexClassName?: string,
    private readonly aerFlags?: string,
    private readonly apexTestClassName?: string
  ) {
    if (this.useAer) {
      if (this.aerSfProjectPath) {
        this.aerWatchRunner = new AerWatchRunner(
          this.aerSfProjectPath,
          this.apexTestClassName,
          this.aerFlags
        )
      }
    } else {
      if (!connection) {
        throw new Error('Connection is required when not running in AER mode')
      }
      this.testService = new TestService(connection)
    }
  }

  public async getTestMethodsPerLines(className: string) {
    if (this.useAer) {
      if (!this.aerSfProjectPath || !this.apexClassName) {
        throw new Error(
          'aerSfProjectPath and apexClassName are required in AER mode'
        )
      }
      return AerAdapter.runBaselineTests({
        aerSfProjectPath: this.aerSfProjectPath,
        apexClassName: this.apexClassName,
        apexTestClassName: className,
        aerFlags: this.aerFlags,
      })
    }

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

  public async startWatch() {
    if (this.useAer && this.aerWatchRunner) {
      await this.aerWatchRunner.start()
    }
  }

  public async runTestMethods(
    className: string,
    testMethods: Set<string> = new Set<string>()
  ) {
    if (this.useAer && this.aerWatchRunner) {
      return this.aerWatchRunner.runTestMethods(testMethods)
    }

    return this.runTestAsynchronous({
      className,
      testMethods: Array.from(testMethods),
    })
  }

  public async destroy() {
    if (this.aerWatchRunner) {
      this.aerWatchRunner.destroy()
    }
  }

  private async runTestAsynchronous(
    testPerimeter: { className: string; testMethods?: string[] },
    skipCodeCoverage: boolean = true
  ) {
    if (!this.testService) {
      throw new Error('Test service not initialized')
    }

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
