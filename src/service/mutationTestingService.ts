import { TestResult } from '@salesforce/apex-node'
import { Connection, Messages } from '@salesforce/core'
import { Progress, Spinner } from '@salesforce/sf-plugins-core'
import type { CommonTokenStream } from 'apex-parser'
import { ApexClassRepository } from '../adapter/apexClassRepository.js'
import { ApexTestRunner } from '../adapter/apexTestRunner.js'
import { SObjectDescribeRepository } from '../adapter/sObjectDescribeRepository.js'
import { ApexClass } from '../type/ApexClass.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { ApexMutationParameter } from '../type/ApexMutationParameter.js'
import { ApexMutationTestResult } from '../type/ApexMutationTestResult.js'
import { ConfigReader, type RE2Instance } from './configReader.js'
import { DSaturGrouper } from './groupers/dsaturGrouper.js'
import { NoOpMutationGrouper } from './groupers/noOpMutationGrouper.js'
import { MutantGenerator } from './mutantGenerator.js'
import {
  assertGroupingInvariants,
  type MutationGroup,
  type MutationGrouper,
} from './mutationGrouper.js'
import { formatDuration, timeExecution } from './timeUtils.js'
import { type TypeAnalysisResult, TypeDiscoverer } from './typeDiscoverer.js'
import { ApexClassTypeMatcher, SObjectTypeMatcher } from './typeMatcher.js'

/**
 * Advance a 1-indexed (line, column) cursor through `text`, returning the
 * position immediately AFTER the last character. Handles tokens whose text
 * spans newlines (multi-line string literals, block comments).
 *
 * Used to compute the Stryker `end` position for a mutation: ANTLR tokens
 * expose `line` and `charPositionInLine` for the START of the token but not
 * past the end; walking `endToken.text` closes that gap without needing a
 * separate line-offset index over the whole source.
 */
function advancePosition(
  text: string,
  startLine: number,
  startColumn: number
): { line: number; column: number } {
  let line = startLine
  let column = startColumn
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) {
      line++
      column = 1
    } else {
      column++
    }
  }
  return { line, column }
}

interface TokenTargetInfo {
  line: number
  column: number
  tokenIndex: number
  text: string
}

interface ErrorClassification {
  status: 'CompileError' | 'Killed' | 'RuntimeError'
  statusReason?: string
  progressMessage: string
}

interface GroupEvalContext {
  group: MutationGroup
  mutantGenerator: MutantGenerator
  tokenStream: CommonTokenStream
  apexClass: ApexClass
  testMethodsPerLine: Map<number, Set<string>>
  apexTestRunner: ApexTestRunner
  apexClassRepository: ApexClassRepository
  completedSoFar: number
}

interface GroupEvalResult {
  mutantResults: ApexMutationTestResult['mutants']
  progressMessage: string
}

interface ErrorClassificationStrategy {
  matches(errorMessage: string): boolean
  classify(
    errorMessage: string,
    targetInfo: TokenTargetInfo
  ): ErrorClassification
}

const errorStrategies: ErrorClassificationStrategy[] = [
  {
    matches: msg => msg.startsWith('Deployment failed:'),
    classify: (msg, targetInfo) => ({
      status: 'CompileError',
      statusReason: msg,
      progressMessage: `Mutation result: compile error at line ${targetInfo.line}`,
    }),
  },
  {
    matches: msg => msg.includes('LIMIT_USAGE_FOR_NS'),
    classify: msg => ({
      status: 'Killed',
      progressMessage: `Mutation result: mutant killed (${msg})`,
    }),
  },
  {
    matches: () => true,
    classify: msg => ({
      status: 'RuntimeError',
      statusReason: msg,
      progressMessage: `Mutation result: runtime error (${msg})`,
    }),
  },
]

export class MutationTestingService {
  protected readonly apexClassName: string
  protected readonly apexTestClassName: string
  protected readonly dryRun: boolean
  protected readonly includeMutators: string[] | undefined
  protected readonly excludeMutators: string[] | undefined
  protected readonly includeTestMethods: string[] | undefined
  protected readonly excludeTestMethods: string[] | undefined
  private readonly skipPatterns: RE2Instance[]
  private readonly allowedLines: Set<number> | undefined
  private readonly mutationGroupingEnabled: boolean
  private readonly grouper: MutationGrouper
  private apexClassContent: string = ''

  constructor(
    protected readonly progress: Progress,
    protected readonly spinner: Spinner,
    protected readonly connection: Connection,
    {
      apexClassName,
      apexTestClassName,
      dryRun,
      includeMutators,
      excludeMutators,
      includeTestMethods,
      excludeTestMethods,
      skipPatterns,
      lines,
      mutationGrouping,
    }: ApexMutationParameter,
    protected readonly messages: Messages<string>
  ) {
    this.apexClassName = apexClassName
    this.apexTestClassName = apexTestClassName
    this.dryRun = dryRun ?? false
    this.includeMutators = includeMutators
    this.excludeMutators = excludeMutators
    this.includeTestMethods = includeTestMethods
    this.excludeTestMethods = excludeTestMethods
    this.skipPatterns = ConfigReader.compileSkipPatterns(skipPatterns)
    this.allowedLines = ConfigReader.parseLineRanges(lines)
    this.mutationGroupingEnabled = mutationGrouping ?? false
    this.grouper = this.mutationGroupingEnabled
      ? new DSaturGrouper()
      : new NoOpMutationGrouper()
  }

  public async process(): Promise<ApexMutationTestResult> {
    const { apexClassRepository, apexTestRunner } = this.createAdapters()
    const apexClass = await this.fetchApexClass(apexClassRepository)
    const typeAnalysis = await this.discoverTypes(
      apexClass,
      apexClassRepository
    )

    const deployTime = await this.verifyCompilation(
      apexClass,
      apexClassRepository
    )
    await this.verifyTestClassCompilation(apexClassRepository)

    const { testMethodsPerLine, testTime } =
      await this.runBaselineTests(apexTestRunner)
    const coveredLines = this.extractCoveredLines(testMethodsPerLine)
    const { mutations, mutantGenerator, tokenStream } = this.generateMutations(
      apexClass,
      coveredLines,
      typeAnalysis
    )

    if (this.dryRun) {
      this.displayTimeEstimate(
        deployTime,
        testTime,
        mutations.length,
        mutations.length
      )
      return this.buildDryRunResult(apexClass, mutations)
    }

    const groups = this.planGroups(mutations, testMethodsPerLine)
    this.displayTimeEstimate(
      deployTime,
      testTime,
      mutations.length,
      groups.length
    )

    const result = await this.executeMutationLoop(
      apexClass,
      mutations,
      groups,
      mutantGenerator,
      tokenStream,
      testMethodsPerLine,
      apexTestRunner,
      apexClassRepository
    )
    await this.rollback(apexClass, apexClassRepository)
    return result
  }

  private planGroups(
    mutations: ApexMutation[],
    testMethodsPerLine: Map<number, Set<string>>
  ): MutationGroup[] {
    if (!this.mutationGroupingEnabled) {
      const groups = this.grouper.group({ mutations, testMethodsPerLine })
      assertGroupingInvariants(mutations, groups)
      return groups
    }

    this.spinner.start(
      `Grouping ${mutations.length} mutations to minimize deployments`,
      undefined,
      { stdout: true }
    )
    const groups = this.grouper.group({ mutations, testMethodsPerLine })
    assertGroupingInvariants(mutations, groups)
    // Division is safe: generateMutations() at line 532 throws when mutations
    // is empty, so planGroups is never reached with mutations.length === 0.
    const savingsPct = Math.round((1 - groups.length / mutations.length) * 100)
    this.spinner.stop(
      this.messages.getMessage('info.groupingPlan', [
        String(mutations.length),
        String(groups.length),
        String(savingsPct),
      ])
    )
    return groups
  }

  public calculateScore(mutationResult: ApexMutationTestResult) {
    const validMutants = mutationResult.mutants.filter(
      mutant => mutant.status !== 'CompileError'
    )
    if (validMutants.length === 0) {
      return 0
    }
    const killedStatuses = new Set(['Killed', 'RuntimeError'])
    return (
      (validMutants.filter(mutant => killedStatuses.has(mutant.status)).length /
        validMutants.length) *
      100
    )
  }

  private buildMutantResult(
    mutation: ApexMutation,
    testResult: TestResult,
    targetInfo: TokenTargetInfo
  ) {
    const mutationStatus: 'Killed' | 'Survived' | 'NoCoverage' =
      testResult.summary.outcome === 'Passed' ? 'Survived' : 'Killed'

    const location = this.calculateMutationPosition(mutation)
    const originalText = this.extractMutationOriginalText(mutation)
    return {
      id: `${this.apexClassName}-${targetInfo.line}-${targetInfo.column}-${targetInfo.tokenIndex}-${Date.now()}`,
      mutatorName: mutation.mutationName,
      status: mutationStatus,
      location,
      replacement: mutation.replacement,
      original: originalText,
    }
  }

  private calculateMutationPosition(mutation: ApexMutation): {
    start: { line: number; column: number }
    end: { line: number; column: number }
  } {
    const start = mutation.target.startToken
    const end = mutation.target.endToken

    if (
      start.startIndex === undefined ||
      end.stopIndex === undefined ||
      end.text === undefined
    ) {
      throw new Error(
        `Failed to calculate position for mutation: ${mutation.mutationName}`
      )
    }

    // ANTLR tokens expose the position of the FIRST character directly.
    // The Stryker `end` position is exclusive (one past the last char), so
    // we walk endToken.text to advance from the end token's own start.
    // This correctly handles tokens that span newlines (multi-line string
    // literals, block comments).
    return {
      start: {
        line: start.line,
        column: start.charPositionInLine + 1,
      },
      // ANTLR tokens always expose `text`; treat an undefined text as a
      // programmer error rather than silently swallowing with an empty default.
      end: advancePosition(end.text, end.line, end.charPositionInLine + 1),
    }
  }

  private filterTestMethods(
    testMethodsPerLine: Map<number, Set<string>>
  ): void {
    const filterSet = this.includeTestMethods
      ? new Set(this.includeTestMethods)
      : this.excludeTestMethods
        ? new Set(this.excludeTestMethods)
        : undefined

    if (!filterSet) {
      return
    }

    const isInclude = Boolean(this.includeTestMethods)

    for (const [line, methods] of testMethodsPerLine) {
      const filtered = new Set(
        [...methods].filter(m =>
          isInclude ? filterSet.has(m) : !filterSet.has(m)
        )
      )
      if (filtered.size === 0) {
        testMethodsPerLine.delete(line)
      } else {
        testMethodsPerLine.set(line, filtered)
      }
    }
  }

  private createAdapters() {
    return {
      apexClassRepository: new ApexClassRepository(this.connection),
      apexTestRunner: new ApexTestRunner(this.connection),
    }
  }

  private async fetchApexClass(
    apexClassRepository: ApexClassRepository
  ): Promise<ApexClass> {
    this.spinner.start(
      `Fetching "${this.apexClassName}" ApexClass content`,
      undefined,
      { stdout: true }
    )
    const apexClass = (await apexClassRepository.read(
      this.apexClassName
    )) as unknown as ApexClass
    this.apexClassContent = apexClass.Body
    this.spinner.stop('Done')
    return apexClass
  }

  private async discoverTypes(
    apexClass: ApexClass,
    apexClassRepository: ApexClassRepository
  ): Promise<TypeAnalysisResult> {
    this.spinner.start(
      `Analyzing class dependencies for "${this.apexClassName}"`,
      undefined,
      { stdout: true }
    )
    const dependencies = await apexClassRepository.getApexClassDependencies(
      apexClass.Id as string
    )

    const apexClassTypes = dependencies
      .filter(dep => dep.RefMetadataComponentType === 'ApexClass')
      .map(dep => dep.RefMetadataComponentName)

    const standardEntityTypes = dependencies
      .filter(dep => dep.RefMetadataComponentType === 'StandardEntity')
      .map(dep => dep.RefMetadataComponentName)

    const customObjectTypes = dependencies
      .filter(dep => dep.RefMetadataComponentType === 'CustomObject')
      .map(dep => dep.RefMetadataComponentName)

    const sObjectDescribeRepository = new SObjectDescribeRepository(
      this.connection
    )
    const apexClassMatcher = new ApexClassTypeMatcher(new Set(apexClassTypes))
    const sObjectMatcher = new SObjectTypeMatcher(
      new Set([...standardEntityTypes, ...customObjectTypes]),
      sObjectDescribeRepository
    )

    const typeDiscoverer = new TypeDiscoverer()
      .withMatcher(apexClassMatcher)
      .withMatcher(sObjectMatcher)

    const analysis = await typeDiscoverer.analyzeFull(apexClass.Body)
    this.spinner.stop('Done')
    return analysis
  }

  private async verifyCompilation(
    apexClass: ApexClass,
    apexClassRepository: ApexClassRepository
  ): Promise<number> {
    this.spinner.start(
      `Verifying "${this.apexClassName}" apex class compilation`,
      undefined,
      { stdout: true }
    )
    try {
      const { durationMs } = await timeExecution(() =>
        apexClassRepository.update(apexClass)
      )
      this.spinner.stop('Done')
      return durationMs
    } catch (error: unknown) {
      this.spinner.stop()
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      throw new Error(
        this.messages.getMessage('error.compilabilityCheckFailed', [
          this.apexClassName,
          errorMessage,
        ])
      )
    }
  }

  private async verifyTestClassCompilation(
    apexClassRepository: ApexClassRepository
  ): Promise<void> {
    this.spinner.start(
      `Verifying "${this.apexTestClassName}" apex test class compilation`,
      undefined,
      { stdout: true }
    )
    try {
      const apexTestClass = (await apexClassRepository.read(
        this.apexTestClassName
      )) as unknown as ApexClass
      await apexClassRepository.update(apexTestClass)
      this.spinner.stop('Done')
    } catch (error: unknown) {
      this.spinner.stop()
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      throw new Error(
        this.messages.getMessage('error.compilabilityCheckFailed', [
          this.apexTestClassName,
          errorMessage,
        ])
      )
    }
  }

  private async runBaselineTests(apexTestRunner: ApexTestRunner): Promise<{
    testMethodsPerLine: Map<number, Set<string>>
    testTime: number
  }> {
    this.spinner.start(
      `Executing "${this.apexTestClassName}" tests to get coverage`,
      undefined,
      { stdout: true }
    )

    const { result: baselineResult, durationMs: testTime } =
      await timeExecution(() =>
        apexTestRunner.getTestMethodsPerLines(this.apexTestClassName)
      )
    const { outcome, testsRan, failing, testMethodsPerLine } = baselineResult

    if (outcome !== 'Passed') {
      this.spinner.stop()
      throw new Error(
        `Original tests failed! Cannot proceed with mutation testing.\n` +
          `Test outcome: ${outcome}\n` +
          `Failing tests: ${failing}\n`
      )
    }

    if (testsRan === 0) {
      this.spinner.stop()
      throw new Error(
        `No tests were executed! Check that:\n` +
          `- Test class '${this.apexTestClassName}' exists\n` +
          `- Test methods have @IsTest annotation\n` +
          `- Test class is properly deployed`
      )
    }

    this.spinner.stop('Original tests passed')
    this.filterTestMethods(testMethodsPerLine)
    return { testMethodsPerLine, testTime }
  }

  private extractCoveredLines(
    testMethodsPerLine: Map<number, Set<string>>
  ): Set<number> {
    const coveredLines = new Set(testMethodsPerLine.keys())
    if (coveredLines.size === 0) {
      throw new Error(
        this.messages.getMessage('error.noCoverage', [
          this.apexClassName,
          this.apexTestClassName,
        ])
      )
    }
    return coveredLines
  }

  private generateMutations(
    apexClass: ApexClass,
    coveredLines: Set<number>,
    typeAnalysis: TypeAnalysisResult
  ): {
    mutations: ApexMutation[]
    mutantGenerator: MutantGenerator
    tokenStream: CommonTokenStream
  } {
    this.spinner.start(
      `Generating mutants for "${this.apexClassName}" ApexClass`,
      undefined,
      { stdout: true }
    )
    const mutantGenerator = new MutantGenerator()
    const mutatorFilter = this.buildMutatorFilter()
    const { mutations, tokenStream } = mutantGenerator.compute(
      apexClass.Body,
      coveredLines,
      typeAnalysis.typeRegistry,
      mutatorFilter,
      this.skipPatterns,
      this.allowedLines,
      { tree: typeAnalysis.tree, tokenStream: typeAnalysis.tokenStream }
    )

    if (mutations.length === 0) {
      this.spinner.stop('0 mutations generated')
      throw new Error(
        this.messages.getMessage('error.noMutations', [
          this.apexClassName,
          coveredLines.size,
        ])
      )
    }

    this.spinner.stop(`${mutations.length} mutations generated`)
    return { mutations, mutantGenerator, tokenStream }
  }

  private buildMutatorFilter():
    | { include: string[] }
    | { exclude: string[] }
    | undefined {
    if (this.includeMutators) return { include: this.includeMutators }
    if (this.excludeMutators) return { exclude: this.excludeMutators }
    return undefined
  }

  private displayTimeEstimate(
    deployTime: number,
    testTime: number,
    mutationCount: number,
    groupCount: number
  ): void {
    const totalEstimateMs = (deployTime + testTime) * groupCount
    this.spinner.start(
      this.messages.getMessage('info.timeEstimate', [
        formatDuration(totalEstimateMs),
      ]),
      undefined,
      { stdout: true }
    )
    this.spinner.stop(
      this.messages.getMessage('info.timeEstimateBreakdown', [
        formatDuration(deployTime),
        formatDuration(testTime),
        String(mutationCount),
        String(groupCount),
      ])
    )
  }

  private buildDryRunResult(
    apexClass: ApexClass,
    mutations: ApexMutation[]
  ): ApexMutationTestResult {
    return {
      sourceFile: this.apexClassName,
      sourceFileContent: apexClass.Body,
      testFile: this.apexTestClassName,
      mutants: mutations.map(mutation => ({
        id: `${this.apexClassName}-${mutation.target.startToken.line}-${mutation.target.startToken.charPositionInLine}-${mutation.target.startToken.tokenIndex}-${Date.now()}`,
        mutatorName: mutation.mutationName,
        status: 'Pending' as const,
        location: this.calculateMutationPosition(mutation),
        replacement: mutation.replacement,
        original: this.extractMutationOriginalText(mutation),
      })),
    }
  }

  private async executeMutationLoop(
    apexClass: ApexClass,
    mutations: ApexMutation[],
    groups: MutationGroup[],
    mutantGenerator: MutantGenerator,
    tokenStream: CommonTokenStream,
    testMethodsPerLine: Map<number, Set<string>>,
    apexTestRunner: ApexTestRunner,
    apexClassRepository: ApexClassRepository
  ): Promise<ApexMutationTestResult> {
    this.progress.start(
      mutations.length,
      { info: 'Starting mutation testing' },
      {
        title: 'MUTATION TESTING PROGRESS',
        format: '%s | {bar} | {value}/{total} {info}',
      }
    )

    const indexByMutation = new Map(mutations.map((m, i) => [m, i]))
    const orderedResults: Array<
      ApexMutationTestResult['mutants'][number] | null
    > = new Array(mutations.length).fill(null)
    let completed = 0
    const loopStartTime = performance.now()

    for (const group of groups) {
      const remainingText = this.formatRemainingTime(
        loopStartTime,
        completed,
        mutations.length
      )
      this.announceGroup(group, remainingText, completed, testMethodsPerLine)

      const { mutantResults, progressMessage } = await this.evaluateGroup({
        group,
        mutantGenerator,
        tokenStream,
        apexClass,
        testMethodsPerLine,
        apexTestRunner,
        apexClassRepository,
        completedSoFar: completed,
      })
      for (let i = 0; i < group.mutations.length; ++i) {
        const idx = indexByMutation.get(group.mutations[i])!
        orderedResults[idx] = mutantResults[i]
      }
      completed += group.mutations.length

      const updatedRemainingText = this.formatRemainingTime(
        loopStartTime,
        completed,
        mutations.length
      )
      this.progress.update(completed, {
        info: `${updatedRemainingText}${progressMessage}`,
      })
    }

    this.progress.finish({ info: 'All mutations evaluated' })
    return {
      sourceFile: this.apexClassName,
      sourceFileContent: apexClass.Body,
      testFile: this.apexTestClassName,
      mutants: orderedResults.filter(
        (r): r is ApexMutationTestResult['mutants'][number] => r !== null
      ),
    }
  }

  private announceGroup(
    group: MutationGroup,
    remainingText: string,
    completedSoFar: number,
    testMethodsPerLine: Map<number, Set<string>>
  ): void {
    if (group.mutations.length === 1) {
      const m = group.mutations[0]
      this.progress.update(completedSoFar, {
        info: `${remainingText}Deploying "${m.replacement}" mutation at line ${m.target.startToken.line}`,
      })
      const testMethods = testMethodsPerLine.get(m.target.startToken.line)
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

  private async evaluateGroup(ctx: GroupEvalContext): Promise<GroupEvalResult> {
    const {
      group,
      mutantGenerator,
      tokenStream,
      apexClass,
      testMethodsPerLine,
      apexTestRunner,
      apexClassRepository,
    } = ctx

    if (group.mutations.length === 1) {
      const { mutantResult, progressMessage } = await this.evaluateMutation(
        group.mutations[0],
        mutantGenerator,
        tokenStream,
        apexClass,
        testMethodsPerLine,
        apexTestRunner,
        apexClassRepository
      )
      return { mutantResults: [mutantResult], progressMessage }
    }

    const mutated = mutantGenerator.mutateMany(group.mutations, tokenStream)
    let testResult: TestResult
    try {
      await apexClassRepository.update({
        Id: apexClass.Id as string,
        Body: mutated,
      })
      testResult = await apexTestRunner.runTestMethods(
        this.apexTestClassName,
        group.testMethods
      )
    } catch {
      return this.fallbackPerMutant(ctx)
    }

    const outcomeByMethod = new Map<string, string>(
      testResult.tests.map(t => [t.methodName, t.outcome])
    )
    for (const expectedMethod of group.testMethods) {
      if (!outcomeByMethod.has(expectedMethod)) {
        return this.fallbackPerMutant(ctx)
      }
    }

    const mutantResults = group.mutations.map(mutation =>
      this.buildGroupedMutantResult(
        mutation,
        outcomeByMethod,
        testMethodsPerLine
      )
    )
    const killed = mutantResults.filter(r => r.status === 'Killed').length
    const survived = mutantResults.length - killed
    return {
      mutantResults,
      progressMessage: `Group of ${group.mutations.length} evaluated: ${killed} killed, ${survived} survived`,
    }
  }

  private async fallbackPerMutant(
    ctx: GroupEvalContext
  ): Promise<GroupEvalResult> {
    const {
      group,
      mutantGenerator,
      tokenStream,
      apexClass,
      testMethodsPerLine,
      apexTestRunner,
      apexClassRepository,
      completedSoFar,
    } = ctx
    this.progress.update(completedSoFar, {
      info: this.messages.getMessage('info.groupingFallback', [
        String(group.mutations.length),
      ]),
    })
    const results: ApexMutationTestResult['mutants'] = []
    for (const m of group.mutations) {
      const { mutantResult } = await this.evaluateMutation(
        m,
        mutantGenerator,
        tokenStream,
        apexClass,
        testMethodsPerLine,
        apexTestRunner,
        apexClassRepository
      )
      results.push(mutantResult)
    }
    return {
      mutantResults: results,
      progressMessage: `Fallback for group of ${group.mutations.length} complete`,
    }
  }

  private buildGroupedMutantResult(
    mutation: ApexMutation,
    outcomeByMethod: Map<string, string>,
    testMethodsPerLine: Map<number, Set<string>>
  ): ApexMutationTestResult['mutants'][number] {
    // outcome strings come from `@salesforce/apex-node`'s ApexTestResultOutcome
    // const enum (Pass | Fail | CompileFail | Skip). Compare against the
    // string literal 'Pass' rather than importing the enum — const enums
    // cross module boundaries poorly under strict ESM.
    // Non-null assertion mirrors evaluateMutation's pattern: extractCoveredLines
    // guarantees every mutation's line is in the coverage map.
    const myMethods = testMethodsPerLine.get(mutation.target.startToken.line)!
    const killed = [...myMethods].some(name => {
      const outcome = outcomeByMethod.get(name)
      return outcome !== undefined && outcome !== 'Pass'
    })
    const status: 'Killed' | 'Survived' = killed ? 'Killed' : 'Survived'
    const targetInfo: TokenTargetInfo = {
      line: mutation.target.startToken.line,
      column: mutation.target.startToken.charPositionInLine,
      tokenIndex: mutation.target.startToken.tokenIndex,
      text: mutation.target.text,
    }
    return {
      id: `${this.apexClassName}-${targetInfo.line}-${targetInfo.column}-${targetInfo.tokenIndex}-${Date.now()}`,
      mutatorName: mutation.mutationName,
      status,
      location: this.calculateMutationPosition(mutation),
      replacement: mutation.replacement,
      original: this.extractMutationOriginalText(mutation),
    }
  }

  private async evaluateMutation(
    mutation: ApexMutation,
    mutantGenerator: MutantGenerator,
    tokenStream: CommonTokenStream,
    apexClass: ApexClass,
    testMethodsPerLine: Map<number, Set<string>>,
    apexTestRunner: ApexTestRunner,
    apexClassRepository: ApexClassRepository
  ): Promise<{
    mutantResult: ApexMutationTestResult['mutants'][number]
    progressMessage: string
  }> {
    const mutatedVersion = mutantGenerator.mutate(mutation, tokenStream)
    const targetInfo: TokenTargetInfo = {
      line: mutation.target.startToken.line,
      column: mutation.target.startToken.charPositionInLine,
      tokenIndex: mutation.target.startToken.tokenIndex,
      text: mutation.target.text,
    }

    try {
      await apexClassRepository.update({
        Id: apexClass.Id as string,
        Body: mutatedVersion,
      })

      const testMethods = testMethodsPerLine.get(targetInfo.line)!
      const testResult: TestResult = await apexTestRunner.runTestMethods(
        this.apexTestClassName,
        testMethods
      )

      return {
        mutantResult: this.buildMutantResult(mutation, testResult, targetInfo),
        progressMessage: `Mutation result: ${testResult.summary.outcome === 'Passed' ? 'zombie' : 'mutant killed'}`,
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      const location = this.calculateMutationPosition(mutation)
      const originalText = this.extractMutationOriginalText(mutation)
      const strategy = errorStrategies.find(s => s.matches(errorMessage))!
      const classification = strategy.classify(errorMessage, targetInfo)

      return {
        mutantResult: {
          id: `${this.apexClassName}-${targetInfo.line}-${targetInfo.column}-${targetInfo.tokenIndex}-${Date.now()}`,
          mutatorName: mutation.mutationName,
          status: classification.status,
          ...(classification.statusReason && {
            statusReason: classification.statusReason,
          }),
          location,
          replacement: mutation.replacement,
          original: originalText,
        },
        progressMessage: classification.progressMessage,
      }
    }
  }

  private formatRemainingTime(
    loopStartTime: number,
    completedCount: number,
    totalCount: number
  ): string {
    if (completedCount === 0) return ''
    const elapsed = performance.now() - loopStartTime
    const avgPerMutant = elapsed / completedCount
    const remainingMs = avgPerMutant * (totalCount - completedCount)
    return `Remaining: ${formatDuration(remainingMs)} | `
  }

  private async rollback(
    apexClass: ApexClass,
    apexClassRepository: ApexClassRepository
  ): Promise<void> {
    this.spinner.start(
      `Rolling back "${this.apexClassName}" ApexClass to its original state`,
      undefined,
      { stdout: true }
    )
    try {
      await apexClassRepository.update(apexClass)
      this.spinner.stop('Done')
    } catch (error: unknown) {
      this.spinner.stop(
        `Rollback FAILED — '${this.apexClassName}' remains in a mutated state on the target org. Redeploy the original class manually.`
      )
      const cause = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Rollback of '${this.apexClassName}' failed. The class on the target org is still in a mutated state. Redeploy manually. Underlying cause: ${cause}`
      )
    }
  }

  private extractMutationOriginalText(mutation: ApexMutation): string {
    const start = mutation.target.startToken
    const end = mutation.target.endToken

    if (
      start.startIndex !== undefined &&
      end.stopIndex !== undefined &&
      this.apexClassContent
    ) {
      return this.apexClassContent.substring(
        start.startIndex,
        end.stopIndex + 1
      )
    }

    throw new Error(
      `Failed to extract original text for mutation: ${mutation.mutationName}`
    )
  }
}
