import type { ApexTestRunResult } from '../type/ApexTestRunResult.js'
import { qualifyTestMethod, type TestMethodId } from '../type/TestMethodId.js'

type CoverageFidelity = 'per-test' | 'aggregate'

export interface CoverageStrategy {
  readonly fidelity: CoverageFidelity
  getTestMethodsPerLine(
    testResult: ApexTestRunResult
  ): Map<number, Set<TestMethodId>>
}

export class PerTestCoverageStrategy implements CoverageStrategy {
  readonly fidelity: CoverageFidelity = 'per-test'
  private readonly targetClassNameLower: string
  constructor(apexClassName: string) {
    this.targetClassNameLower = apexClassName.toLowerCase()
  }
  public getTestMethodsPerLine(
    testResult: ApexTestRunResult
  ): Map<number, Set<TestMethodId>> {
    const testMethodsPerLine = new Map<number, Set<TestMethodId>>()
    testResult.tests?.forEach(test => {
      test.coverage
        ?.filter(
          coverage =>
            coverage.className.toLowerCase() === this.targetClassNameLower
        )
        .forEach(coverage => {
          coverage.detail?.coveredLines?.forEach(line => {
            const testMethods =
              testMethodsPerLine.get(line) ?? new Set<TestMethodId>()
            testMethods.add(
              qualifyTestMethod(test.className, coverage.testMethodName)
            )
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
    testResult: ApexTestRunResult
  ): Map<number, Set<TestMethodId>> {
    const testMethodNames = new Set(
      testResult.tests?.map(test =>
        qualifyTestMethod(test.className, test.methodName)
      ) ?? []
    )
    const aggregateCoverage = testResult.classCoverage?.find(
      coverage => coverage.className.toLowerCase() === this.targetClassNameLower
    )
    const testMethodsPerLine = new Map<number, Set<TestMethodId>>()
    aggregateCoverage?.coveredLines?.forEach(line =>
      testMethodsPerLine.set(line, new Set(testMethodNames))
    )
    return testMethodsPerLine
  }
}
