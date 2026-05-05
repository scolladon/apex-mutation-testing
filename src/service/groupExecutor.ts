import { TestResult } from '@salesforce/apex-node'
import { Messages } from '@salesforce/core'
import { Progress } from '@salesforce/sf-plugins-core'
import type { CommonTokenStream } from 'apex-parser'
import { ApexClassRepository } from '../adapter/apexClassRepository.js'
import { ApexTestRunner } from '../adapter/apexTestRunner.js'
import { ApexClass } from '../type/ApexClass.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { ApexMutationTestResult } from '../type/ApexMutationTestResult.js'
import { MutantGenerator } from './mutantGenerator.js'
import { MutationGroup } from './mutationGrouper.js'
import {
  calculateMutationPosition,
  extractMutationOriginalText,
} from './mutationLocation.js'
import { formatRemainingTime } from './timeUtils.js'

// Classify a deploy/test-run error into a per-mutant outcome plus a progress
// message. The three branches match Salesforce-side failure modes: a compile
// error from the Tooling API deploy, a governor-limit kill (which is a real
// kill, not a runtime error), and any other thrown error.
const classifyError = (
  error: unknown,
  mutation: ApexMutation
): {
  status: 'CompileError' | 'Killed' | 'RuntimeError'
  statusReason?: string
  progressMessage: string
} => {
  const message = error instanceof Error ? error.message : String(error)
  if (message.startsWith('Deployment failed:')) {
    return {
      status: 'CompileError',
      statusReason: message,
      progressMessage: `Mutation result: compile error at line ${mutation.target.startToken.line}`,
    }
  }
  if (message.includes('LIMIT_USAGE_FOR_NS')) {
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
    private readonly apexTestClassName: string,
    private readonly apexClassContent: string,
    private readonly tokenStream: CommonTokenStream,
    private readonly testMethodsPerLine: Map<number, Set<string>>,
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
      testResult = await this.apexTestRunner.runTestMethods(
        this.apexTestClassName,
        group.testMethods
      )
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

    // Leaf for k=1 with caught error: classify the error directly. (k>1 with
    // an error was handled above by recursing into singletons.)
    if (batchError !== undefined) {
      const mutation = group.mutations[0]
      const c = classifyError(batchError, mutation)
      return {
        mutantResults: [
          this.buildMutantResult(mutation, c.status, c.statusReason),
        ],
        progressMessage: c.progressMessage,
      }
    }

    // Success path. Per-method outcomes when present (required for k>1
    // attribution); fall back to summary-derived outcome when the test
    // runner did not report per-method data (legacy behaviour for k=1).
    const outcomeByMethod = new Map<string, string>(
      (testResult!.tests ?? []).map(t => [t.methodName, t.outcome])
    )
    const summaryFallback =
      testResult!.summary.outcome === 'Passed' ? 'Pass' : 'Fail'
    const mutantResults = group.mutations.map(m => {
      const myMethods =
        this.testMethodsPerLine.get(m.target.startToken.line) ??
        new Set<string>()
      // No covering tests (only possible in mocked or uncovered-line scenarios)
      // → fall back to the summary outcome so behaviour matches the legacy
      // evaluateMutation path.
      const killed =
        myMethods.size === 0
          ? summaryFallback !== 'Pass'
          : [...myMethods].some(
              name => (outcomeByMethod.get(name) ?? summaryFallback) !== 'Pass'
            )
      return this.buildMutantResult(m, killed ? 'Killed' : 'Survived')
    })

    return {
      mutantResults,
      progressMessage: this.buildGroupProgressMessage(mutantResults),
    }
  }

  private hasCoverageGap(
    testResult: TestResult,
    expectedMethods: Set<string>
  ): boolean {
    const reported = new Set(testResult.tests.map(t => t.methodName))
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
    statusReason?: string
  ): ApexMutationTestResult['mutants'][number] {
    const start = mutation.target.startToken
    return {
      id: `${this.apexClassName}-${start.line}-${start.charPositionInLine}-${start.tokenIndex}-${Date.now()}`,
      mutatorName: mutation.mutationName,
      status,
      ...(statusReason && { statusReason }),
      location: calculateMutationPosition(mutation),
      replacement: mutation.replacement,
      original: extractMutationOriginalText(mutation, this.apexClassContent),
    }
  }
}
