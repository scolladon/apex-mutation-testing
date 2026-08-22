import { Messages } from '@salesforce/core'
import { Progress } from '@salesforce/sf-plugins-core'
import type { CommonTokenStream } from 'apex-parser'
import type { MutantVerdict, MutationTestBed } from '../port/mutationTestBed.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { ApexMutationTestResult } from '../type/ApexMutationTestResult.js'
import type { ApexTestRunResult } from '../type/ApexTestRunResult.js'
import { qualifyTestMethod, type TestMethodId } from '../type/TestMethodId.js'
import { MutantGenerator } from './mutantGenerator.js'
import { MutationGroup } from './mutationGrouper.js'
import {
  calculateMutationPosition,
  extractMutationOriginalText,
} from './mutationLocation.js'
import { formatRemainingTime } from './timeUtils.js'

const PASS_OUTCOME = 'Pass'
// The non-pass branch's literal value is never itself observed: every consumer
// (buildAttributedResult) only tests `!== 'Pass'`, so any distinct non-pass
// string is behaviourally interchangeable — 'Fail' is chosen for readability
// during debugging, not correctness.
// Stryker disable next-line StringLiteral: any non-pass value behaves the same.
const NON_PASS_OUTCOME = 'Fail'

// Classify a caught evaluate() failure into a RuntimeError outcome plus a
// progress message. Apex runtime exception text carries no localisation risk
// analogous to a platform API error: a live-org probe found a
// System.LimitException coming back in English from a French-locale org, in
// the same session as a platform API error that came back in French, so the
// two are localised independently. A governor-limit exception never reaches
// this function at all: the org reports it as an ordinary failing test row
// (HTTP 200, no throw), which attributeOutcomes already scores as Killed
// through the row's non-Pass outcome. Any other thrown error is reported as
// a RuntimeError.
const classifyRuntimeError = (
  error: unknown
): {
  status: 'RuntimeError'
  statusReason: string
  progressMessage: string
} => {
  const message = error instanceof Error ? error.message : String(error)
  return {
    status: 'RuntimeError',
    statusReason: message,
    progressMessage: `Mutation result: runtime error (${message})`,
  }
}

// A caught evaluate() failure, folded in alongside the port's own verdict so
// the k>1 recursion predicate and the k=1 leaf can narrow over one
// discriminated union instead of a caught value and a returned one.
type GroupOutcome = { kind: 'threw'; error: unknown } | MutantVerdict

// Owns per-iteration evaluation: evaluate the mutated source through the
// test bed, attribute outcomes per mutation. A singleton group (k=1) is the
// leaf case — error classification and status determination live here.
// Multi-mutation groups (k>1) recurse into singletons on any failure
// (thrown, non-compiling, missing outcome). All progress UI for a single
// iteration is emitted from this class so the lifecycle service stays
// focused on orchestration.
export class GroupExecutor {
  constructor(
    private readonly apexClassName: string,
    private readonly apexClassContent: string,
    private readonly tokenStream: CommonTokenStream,
    private readonly testMethodsPerLine: Map<number, Set<TestMethodId>>,
    private readonly mutantGenerator: MutantGenerator,
    private readonly testBed: MutationTestBed,
    private readonly progress: Progress,
    private readonly messages: Messages<string>
  ) {}

  public async evaluate(
    group: MutationGroup,
    completedSoFar: number,
    loopStartTime: number,
    totalMutations: number
  ): Promise<ApexMutationTestResult['mutants']> {
    const remainingText = formatRemainingTime(
      loopStartTime,
      completedSoFar,
      totalMutations
    )
    this.announceGroup(group, remainingText, completedSoFar)

    const { mutantResults, progressMessage } = await this.evaluateGroup(
      group,
      completedSoFar
    )

    const newCompleted = completedSoFar + group.mutations.length
    const updatedRemainingText = formatRemainingTime(
      loopStartTime,
      newCompleted,
      totalMutations
    )
    this.progress.update(newCompleted, {
      info: `${updatedRemainingText}${progressMessage}`,
    })
    return mutantResults
  }

  private announceGroup(
    group: MutationGroup,
    remainingText: string,
    completedSoFar: number
  ): void {
    if (group.mutations.length === 1) {
      const m = group.mutations[0]
      this.progress.update(completedSoFar, {
        info: `${remainingText}Deploying "${m.replacement}" mutation at line ${m.target.startToken.line}`,
      })
      const testMethods = this.testMethodsPerLine.get(m.target.startToken.line)
      if (testMethods) {
        this.progress.update(completedSoFar, {
          info: `${remainingText}Running ${testMethods.size} tests methods for "${m.replacement}" mutation at line ${m.target.startToken.line}`,
        })
      }
      return
    }
    const lines = group.mutations
      .map(m => m.target.startToken.line)
      .sort((a, b) => a - b)
      .join(', ')
    this.progress.update(completedSoFar, {
      info: `${remainingText}Evaluating ${group.mutations.length} mutations on lines ${lines}`,
    })
  }

  // The try/catch is extracted so the union stays a `const`: with `let
  // outcome` assigned from both arms of a try/catch, TypeScript's
  // definite-assignment analysis is conservative and the narrowing below
  // would need a non-null dance instead of the discriminant carrying it.
  private async runGroup(
    mutated: string,
    tests: ReadonlySet<TestMethodId>
  ): Promise<GroupOutcome> {
    try {
      return await this.testBed.evaluate(mutated, tests)
    } catch (error: unknown) {
      return { kind: 'threw', error }
    }
  }

  private async evaluateGroup(
    group: MutationGroup,
    completedSoFar: number
  ): Promise<{
    mutantResults: ApexMutationTestResult['mutants']
    progressMessage: string
  }> {
    const mutated = this.mutantGenerator.mutateMany(
      group.mutations,
      this.tokenStream
    )
    const outcome = await this.runGroup(mutated, group.testMethods)

    // For k>1, an outcome that is not a clean execution — a thrown batch
    // error or a non-compiling mutant — or a coverage gap (test runner did
    // not report every expected method) makes attribution ambiguous.
    // Recurse with each mutation as its own singleton group; each child call
    // hits the leaf and either succeeds or classifies its outcome directly.
    if (
      group.mutations.length > 1 &&
      (outcome.kind !== 'executed' ||
        this.hasCoverageGap(outcome.result, group.testMethods))
    ) {
      return this.recurseIntoSingletons(group, completedSoFar)
    }

    // Leaf for k=1 with a non-compiling mutant. (k>1 with this outcome was
    // handled above by recursing into singletons.) No test outcomes were
    // observed, so no attribution.
    if (outcome.kind === 'not-compilable') {
      const mutation = group.mutations[0]
      return {
        mutantResults: [
          this.buildMutantResult(mutation, 'CompileError', {
            statusReason: outcome.detail,
          }),
        ],
        progressMessage: `Mutation result: compile error at line ${mutation.target.startToken.line}`,
      }
    }

    // Leaf for k=1 with a caught error: classify it directly.
    if (outcome.kind === 'threw') {
      const mutation = group.mutations[0]
      const c = classifyRuntimeError(outcome.error)
      return {
        mutantResults: [
          this.buildMutantResult(mutation, c.status, {
            statusReason: c.statusReason,
          }),
        ],
        progressMessage: c.progressMessage,
      }
    }

    const mutantResults = this.attributeOutcomes(group, outcome.result)
    return {
      mutantResults,
      progressMessage: this.buildGroupProgressMessage(mutantResults),
    }
  }

  // Re-evaluates each mutation in the group as its own singleton group,
  // aggregating the leaf results into one fallback outcome for the caller.
  private async recurseIntoSingletons(
    group: MutationGroup,
    completedSoFar: number
  ): Promise<{
    mutantResults: ApexMutationTestResult['mutants']
    progressMessage: string
  }> {
    this.progress.update(completedSoFar, {
      info: this.messages.getMessage('info.groupingFallback', [
        String(group.mutations.length),
      ]),
    })
    const fallbackResults: ApexMutationTestResult['mutants'] = []
    for (const m of group.mutations) {
      const singleton: MutationGroup = {
        mutations: [m],
        // extractCoveredLines guarantees the line is in the map.
        testMethods: this.testMethodsPerLine.get(m.target.startToken.line)!,
      }
      const { mutantResults } = await this.evaluateGroup(
        singleton,
        completedSoFar
      )
      fallbackResults.push(...mutantResults)
    }
    return {
      mutantResults: fallbackResults,
      progressMessage: `Fallback for group of ${group.mutations.length} complete`,
    }
  }

  // Success path. Per-method outcomes when present (required for k>1
  // attribution); fall back to the summary-derived outcome when the test runner
  // did not report per-method data (legacy behaviour for k=1).
  private attributeOutcomes(
    group: MutationGroup,
    testResult: ApexTestRunResult
  ): ApexMutationTestResult['mutants'] {
    const outcomeByMethod = new Map<TestMethodId, string>(
      // `tests` is typed non-nullable, so this fallback never executes; forced
      // anyway, the resulting "undefined.undefined" entry is never looked up
      // — only real ids are queried.
      (testResult.tests ?? []).map(t => [
        qualifyTestMethod(t.classId, t.methodName),
        t.outcome,
      ])
    )
    const summaryFallback =
      testResult.outcome === 'Passed' ? PASS_OUTCOME : NON_PASS_OUTCOME
    return group.mutations.map(mutation =>
      this.buildAttributedResult(mutation, outcomeByMethod, summaryFallback)
    )
  }

  private buildAttributedResult(
    mutation: ApexMutation,
    outcomeByMethod: ReadonlyMap<TestMethodId, string>,
    summaryFallback: string
  ): ApexMutationTestResult['mutants'][number] {
    const myMethods =
      this.testMethodsPerLine.get(mutation.target.startToken.line) ??
      new Set<TestMethodId>()
    // No covering tests (only possible in mocked or uncovered-line scenarios)
    // → fall back to the summary outcome so behaviour matches the legacy
    // evaluateMutation path. Nobody to attribute the verdict to, so no
    // attribution — emitting coveredBy: [] for a Killed mutant would be a
    // contradiction the schema cannot express.
    if (myMethods.size === 0) {
      const killed = summaryFallback !== PASS_OUTCOME
      return this.buildMutantResult(mutation, killed ? 'Killed' : 'Survived')
    }

    const coveredBy = [...myMethods].sort()
    const killedBy: TestMethodId[] = []
    let testsCompleted = 0
    for (const name of coveredBy) {
      const outcome = outcomeByMethod.get(name)
      if (outcome === undefined) continue
      testsCompleted++
      if (outcome !== PASS_OUTCOME) killedBy.push(name)
    }
    // A method that never reported falls back to the run summary; deriving the
    // verdict from the counts keeps it in lockstep with the attribution above,
    // rather than re-expressing the kill rule a second way.
    const someOutcomeMissing = testsCompleted < coveredBy.length
    const killed =
      killedBy.length > 0 ||
      (someOutcomeMissing && summaryFallback !== PASS_OUTCOME)
    return this.buildMutantResult(mutation, killed ? 'Killed' : 'Survived', {
      attribution: { coveredBy, killedBy, testsCompleted },
    })
  }

  private hasCoverageGap(
    testResult: ApexTestRunResult,
    expectedMethods: ReadonlySet<TestMethodId>
  ): boolean {
    const reported = new Set(
      testResult.tests.map(t => qualifyTestMethod(t.classId, t.methodName))
    )
    for (const name of expectedMethods) {
      if (!reported.has(name)) return true
    }
    return false
  }

  private buildGroupProgressMessage(
    mutantResults: ApexMutationTestResult['mutants']
  ): string {
    if (mutantResults.length === 1) {
      return `Mutation result: ${mutantResults[0].status === 'Survived' ? 'zombie' : 'mutant killed'}`
    }
    const killed = mutantResults.filter(r => r.status === 'Killed').length
    return `Group of ${mutantResults.length} evaluated: ${killed} killed, ${mutantResults.length - killed} survived`
  }

  private buildMutantResult(
    mutation: ApexMutation,
    status: 'Killed' | 'Survived' | 'CompileError' | 'RuntimeError',
    extras: {
      statusReason?: string
      attribution?: ApexMutationTestResult['mutants'][number]['attribution']
    } = {}
  ): ApexMutationTestResult['mutants'][number] {
    const start = mutation.target.startToken
    return {
      id: `${this.apexClassName}-${start.line}-${start.charPositionInLine}-${start.tokenIndex}-${Date.now()}`,
      mutatorName: mutation.mutationName,
      status,
      ...(extras.statusReason && { statusReason: extras.statusReason }),
      ...(extras.attribution && { attribution: extras.attribution }),
      location: calculateMutationPosition(mutation),
      replacement: mutation.replacement,
      original: extractMutationOriginalText(mutation, this.apexClassContent),
    }
  }
}
