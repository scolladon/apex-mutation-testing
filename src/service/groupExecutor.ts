import { TestResult } from '@salesforce/apex-node'
import { Messages } from '@salesforce/core'
import { Progress } from '@salesforce/sf-plugins-core'
import type { CommonTokenStream } from 'apex-parser'
import {
  ApexClassRepository,
  DeploymentFailedError,
} from '../adapter/apexClassRepository.js'
import { ApexTestRunner } from '../adapter/apexTestRunner.js'
import { ApexClass } from '../type/ApexClass.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { ApexMutationTestResult } from '../type/ApexMutationTestResult.js'
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

// Salesforce's org-thrown limit exception carries this code untranslated,
// even though its message is localised to the org user's language.
const LIMIT_USAGE_ERROR_CODE = 'LIMIT_USAGE_FOR_NS'

// Reads the structured `errorCode` a jsforce/org error carries, without
// trusting its (possibly localised) message text. Not exported: callers
// outside this module have no need for it.
const readErrorCode = (error: unknown): string | undefined => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'errorCode' in error &&
    typeof error.errorCode === 'string'
  ) {
    return error.errorCode
  }
  return undefined
}

// Classify a deploy/test-run error into a per-mutant outcome plus a progress
// message. The three branches match Salesforce-side failure modes: a compile
// error from the Tooling API deploy, a governor-limit kill (which is a real
// kill, not a runtime error), and any other thrown error. Both structural
// checks read typed signals (error class, errorCode) rather than message
// text, which Salesforce localises to the org user's language.
const classifyError = (
  error: unknown,
  mutation: ApexMutation
): {
  status: 'CompileError' | 'Killed' | 'RuntimeError'
  statusReason?: string
  progressMessage: string
} => {
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof DeploymentFailedError) {
    return {
      status: 'CompileError',
      statusReason: message,
      progressMessage: `Mutation result: compile error at line ${mutation.target.startToken.line}`,
    }
  }
  if (readErrorCode(error) === LIMIT_USAGE_ERROR_CODE) {
    return {
      status: 'Killed',
      progressMessage: `Mutation result: mutant killed (${message})`,
    }
  }
  return {
    status: 'RuntimeError',
    statusReason: message,
    progressMessage: `Mutation result: runtime error (${message})`,
  }
}

// Owns per-iteration evaluation: deploy mutated source, run union of covering
// tests, attribute outcomes per mutation. A singleton group (k=1) is the leaf
// case — error classification and status determination live here. Multi-mutation
// groups (k>1) recurse into singletons on any failure (deploy, run, missing
// outcome). All progress UI for a single iteration is emitted from this class
// so the lifecycle service stays focused on orchestration.
export class GroupExecutor {
  constructor(
    private readonly apexClass: ApexClass,
    private readonly apexClassName: string,
    private readonly apexClassContent: string,
    private readonly tokenStream: CommonTokenStream,
    private readonly testMethodsPerLine: Map<number, Set<TestMethodId>>,
    private readonly mutantGenerator: MutantGenerator,
    private readonly apexTestRunner: ApexTestRunner,
    private readonly apexClassRepository: ApexClassRepository,
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
    let testResult: TestResult | undefined
    let batchError: unknown
    try {
      await this.apexClassRepository.update({
        Id: this.apexClass.Id as string,
        Body: mutated,
      })
      testResult = await this.apexTestRunner.runTestMethods(group.testMethods)
    } catch (error: unknown) {
      batchError = error
    }

    // For k>1, a batch error or a coverage gap (test runner did not report
    // every expected method) makes attribution ambiguous. Recurse with each
    // mutation as its own singleton group; each child call hits the leaf and
    // either succeeds or classifies its error directly.
    if (
      group.mutations.length > 1 &&
      (batchError !== undefined ||
        this.hasCoverageGap(testResult!, group.testMethods))
    ) {
      return this.recurseIntoSingletons(group, completedSoFar)
    }

    // Leaf for k=1 with caught error: classify the error directly. (k>1 with
    // an error was handled above by recursing into singletons.) No test
    // outcomes were observed, so no attribution.
    if (batchError !== undefined) {
      const mutation = group.mutations[0]
      const c = classifyError(batchError, mutation)
      return {
        mutantResults: [
          this.buildMutantResult(mutation, c.status, {
            statusReason: c.statusReason,
          }),
        ],
        progressMessage: c.progressMessage,
      }
    }

    const mutantResults = this.attributeOutcomes(group, testResult!)
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
    testResult: TestResult
  ): ApexMutationTestResult['mutants'] {
    const outcomeByMethod = new Map<TestMethodId, string>(
      (testResult.tests ?? []).map(t => [
        qualifyTestMethod(t.apexClass.fullName, t.methodName),
        t.outcome,
      ])
    )
    const summaryFallback =
      testResult.summary.outcome === 'Passed' ? PASS_OUTCOME : NON_PASS_OUTCOME
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
    testResult: TestResult,
    expectedMethods: Set<TestMethodId>
  ): boolean {
    const reported = new Set(
      testResult.tests.map(t =>
        qualifyTestMethod(t.apexClass.fullName, t.methodName)
      )
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
