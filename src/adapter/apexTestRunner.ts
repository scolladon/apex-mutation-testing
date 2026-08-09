import { TestLevel, TestResult, TestService } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'

export class ApexTestRunner {
  protected readonly testService: TestService
  constructor(connection: Connection) {
    this.testService = new TestService(connection)
  }

  public async getTestMethodsPerLines(classNames: string[]) {
    const tests = classNames.map(className => ({ className }))
    const testResult = await this.runTestAsynchronous(tests, false)

    const testMethodsPerLine = new Map<number, Set<string>>()

    testResult.tests?.forEach(test => {
      test.perClassCoverage?.forEach(testMethodExecutionResult => {
        testMethodExecutionResult.coverage?.coveredLines?.forEach(line => {
          if (!testMethodsPerLine.has(line)) {
            testMethodsPerLine.set(line, new Set<string>())
          }
          testMethodsPerLine
            .get(line)!
            .add(
              `${test.apexClass?.name}.${testMethodExecutionResult.apexTestMethodName}`
            )
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

  public async runTestMethods(testMethods: Set<string> = new Set<string>()) {
    const classToMethods = new Map<string, Set<string>>()

    for (const method of testMethods) {
      const [className, methodName] = method.includes('.')
        ? method.split('.')
        : ['', method]

      if (!classToMethods.has(className)) {
        classToMethods.set(className, new Set())
      }
      classToMethods.get(className)!.add(methodName)
    }

    const tests = Array.from(classToMethods, ([className, methods]) => ({
      className,
      testMethods: Array.from(methods),
    }))

    return this.runTestAsynchronous(tests)
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
