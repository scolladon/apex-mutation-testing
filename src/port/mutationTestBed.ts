import type { ApexClass } from '../type/ApexClass.js'
import type { ApexTestRunResult } from '../type/ApexTestRunResult.js'
import type { TestMethodId } from '../type/TestMethodId.js'

// Whether a restore deploy asks the org to run tests. Named rather than a
// bare boolean so the call sites read as intent instead of a flag.
// Neither literal value is itself observable: the only consumer tests
// `testPolicy === RUN_TESTS` (createDeployRequest in the org repository), so
// RUN_TESTS can change freely as long as the default parameter — which reads
// RUN_TESTS itself — changes with it, and SKIP_TESTS can be any value
// distinct from RUN_TESTS and still produce the same `!== RUN_TESTS` outcome.
// Stryker disable next-line StringLiteral: value is never itself observed — see above.
export const RUN_TESTS = 'run-tests'
// Stryker disable next-line StringLiteral: value is never itself observed — see above.
export const SKIP_TESTS = 'skip-tests'
export type RestorePolicy = typeof RUN_TESTS | typeof SKIP_TESTS

export type MutantVerdict =
  | { kind: 'not-compilable'; detail: string }
  | { kind: 'executed'; result: ApexTestRunResult }

export interface BaselineCompileFailure {
  classId: string
  className: string
  message: string
}

export interface Baseline {
  outcome: string
  testsRan: number
  compileFailures: BaselineCompileFailure[]
  otherFailureCount: number
  testMethodsPerLine: Map<number, Set<TestMethodId>>
  fidelity: 'per-test' | 'aggregate'
  cost: { applyMs: number; runMs: number }
}

export interface PrepareHooks {
  onVerifying(): void
  onVerified(): void
  onBaselineStarting(): void
}

// Raised by prepare() when the compile gate fails — the one prepare failure the
// service must re-render (as error.compilabilityCheckFailed). Everything else
// prepare can raise propagates raw, exactly as the baseline run lets it today,
// so this needs no `phase` discriminator: the type IS the discriminator.
//
// `reason` is the readable field: oclif's formatError renders message + code +
// actions only, so `cause` never reaches a terminal. `cause` is still set, via
// the ErrorOptions form, so nothing is swallowed for stack tooling.
export class CompilationCheckFailedError extends Error {
  constructor(public readonly reason: Error) {
    super(reason.message, { cause: reason })
    this.name = 'CompilationCheckFailedError'
  }
}

// The seam that keeps the org SDK out of the orchestration layer: the service
// asks for a baseline and a verdict per mutant, and never learns how either is
// obtained.
export interface MutationTestBed {
  // prepare is a precondition of evaluate and restore: it is where the bed
  // captures the original class handle and body.
  prepare(
    original: ApexClass,
    perimeter: string[],
    hooks: PrepareHooks
  ): Promise<Baseline>
  evaluate(
    mutatedBody: string,
    tests: ReadonlySet<TestMethodId>
  ): Promise<MutantVerdict>
  restore(policy: RestorePolicy): Promise<void>
}
