import type { TestResult } from '@salesforce/apex-node'

type CoverageFidelity = 'per-test' | 'aggregate'

export interface CoverageStrategy {
  readonly fidelity: CoverageFidelity
  getTestMethodsPerLine(testResult: TestResult): Map<number, Set<string>>
}

export class PerTestCoverageStrategy implements CoverageStrategy {
  readonly fidelity: CoverageFidelity = 'per-test'
  private readonly targetClassNameLower: string
  constructor(apexClassName: string) {
    this.targetClassNameLower = apexClassName.toLowerCase()
  }
  public getTestMethodsPerLine(
    testResult: TestResult
  ): Map<number, Set<string>> {
    const testMethodsPerLine = new Map<number, Set<string>>()
    testResult.tests?.forEach(test => {
      test.perClassCoverage
        ?.filter(
          coverage =>
            coverage.apexClassOrTriggerName.toLowerCase() ===
            this.targetClassNameLower
        )
        .forEach(coverage => {
          coverage.coverage?.coveredLines?.forEach(line => {
            const testMethods =
              testMethodsPerLine.get(line) ?? new Set<string>()
            testMethods.add(coverage.apexTestMethodName)
            testMethodsPerLine.set(line, testMethods)
          })
        })
    })
    return testMethodsPerLine
  }
}

export class AggregateCoverageStrategy implements CoverageStrategy {
  readonly fidelity: CoverageFidelity = 'aggregate'
  private readonly targetClassNameLower: string
  constructor(apexClassName: string) {
    this.targetClassNameLower = apexClassName.toLowerCase()
  }
  public getTestMethodsPerLine(
    testResult: TestResult
  ): Map<number, Set<string>> {
    const testMethodNames = new Set(
      testResult.tests?.map(test => test.methodName) ?? []
    )
    const aggregateCoverage = testResult.codecoverage?.find(
      coverage => coverage.name.toLowerCase() === this.targetClassNameLower
    )
    const testMethodsPerLine = new Map<number, Set<string>>()
    aggregateCoverage?.coveredLines?.forEach(line =>
      testMethodsPerLine.set(line, new Set(testMethodNames))
    )
    return testMethodsPerLine
  }
}
