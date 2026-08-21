import type { ApexTestRunResult } from '../type/ApexTestRunResult.js'
import { qualifyTestMethod, type TestMethodId } from '../type/TestMethodId.js'

type CoverageFidelity = 'per-test' | 'aggregate'

export interface CoverageStrategy {
  readonly fidelity: CoverageFidelity
  getTestMethodsPerLine(
    testResult: ApexTestRunResult
  ): Map<number, Set<TestMethodId>>
}

// Both strategies join coverage rows to the class under mutation on
// ApexClass.Id, never on the class name: covered-class names come back
// bare from the org's own coverage query regardless of namespace, so a
// name join would either miss a namespaced target entirely or conflate two
// same-named classes from different namespaces. The Id is pinned at 18
// characters on both a namespaced and a non-namespaced org, on both
// transports, so the comparison below is a plain `===` — no case folding,
// no width normalisation.
export class PerTestCoverageStrategy implements CoverageStrategy {
  readonly fidelity: CoverageFidelity = 'per-test'
  constructor(private readonly targetClassId: string) {}
  public getTestMethodsPerLine(
    testResult: ApexTestRunResult
  ): Map<number, Set<TestMethodId>> {
    const testMethodsPerLine = new Map<number, Set<TestMethodId>>()
    testResult.tests?.forEach(test => {
      test.coverage
        ?.filter(coverage => coverage.classId === this.targetClassId)
        .forEach(coverage => {
          coverage.detail?.coveredLines?.forEach(line => {
            const testMethods =
              testMethodsPerLine.get(line) ?? new Set<TestMethodId>()
            testMethods.add(
              qualifyTestMethod(test.classId, coverage.testMethodName)
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
  constructor(private readonly targetClassId: string) {}
  public getTestMethodsPerLine(
    testResult: ApexTestRunResult
  ): Map<number, Set<TestMethodId>> {
    const testMethodNames = new Set(
      testResult.tests?.map(test =>
        qualifyTestMethod(test.classId, test.methodName)
      ) ?? []
    )
    const aggregateCoverage = testResult.classCoverage?.find(
      coverage => coverage.classId === this.targetClassId
    )
    const testMethodsPerLine = new Map<number, Set<TestMethodId>>()
    aggregateCoverage?.coveredLines?.forEach(line =>
      testMethodsPerLine.set(line, new Set(testMethodNames))
    )
    return testMethodsPerLine
  }
}
