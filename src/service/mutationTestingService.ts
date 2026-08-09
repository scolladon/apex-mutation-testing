import { Connection, Messages } from '@salesforce/core'
import { Progress, Spinner } from '@salesforce/sf-plugins-core'
import type { CommonTokenStream } from 'apex-parser'
import {
  ApexClassRepository,
  SKIP_TESTS,
} from '../adapter/apexClassRepository.js'
import { ApexSettingsRepository } from '../adapter/apexSettingsRepository.js'
import {
  ApexTestRunner,
  type BaselineCompileFailure,
  type BaselineTestResult,
} from '../adapter/apexTestRunner.js'
import { SObjectDescribeRepository } from '../adapter/sObjectDescribeRepository.js'
import { ApexClass } from '../type/ApexClass.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { ApexMutationParameter } from '../type/ApexMutationParameter.js'
import { ApexMutationTestResult } from '../type/ApexMutationTestResult.js'
import {
  attachSuiteProvenance,
  reducePerimeter,
  SkippedTestClass,
} from '../type/SkippedTestClass.js'
import { TestClassOrigins } from '../type/TestClassOrigin.js'
import {
  type TestMethodId,
  testClassOf,
  testMethodOf,
} from '../type/TestMethodId.js'
import { ConfigReader } from './configReader.js'
import {
  AggregateCoverageStrategy,
  type CoverageStrategy,
  PerTestCoverageStrategy,
} from './coverageStrategy.js'
import { decideExactOutcome, solveColoring } from './exactColoring.js'
import { GroupExecutor } from './groupExecutor.js'
import { MutantGenerator } from './mutantGenerator.js'
import {
  assembleGroups,
  groupMutationsWithInternals,
  type MutationGroup,
} from './mutationGrouper.js'
import {
  calculateMutationPosition,
  extractMutationOriginalText,
} from './mutationLocation.js'
import type { SkipPattern } from './skipPattern.js'
import {
  formatSkippedTestClasses,
  sanitizeForDisplay,
} from './skippedTestClassMessage.js'
import { formatDuration, timeExecution } from './timeUtils.js'
import { type TypeAnalysisResult, TypeDiscoverer } from './typeDiscoverer.js'
import { ApexClassTypeMatcher, SObjectTypeMatcher } from './typeMatcher.js'

// A filter entry matches a coverage-map id either by its full qualified form
// (scoping the entry to one declaring class) or by its bare method name
// (applying the entry to that method in every perimeter class). Both the CLI
// flag and the .mutation-testing.json testMethods block land in the same
// includeTestMethods/excludeTestMethods fields, so this single rule covers both.
const matchesFilter = (id: TestMethodId, filterSet: Set<string>): boolean =>
  filterSet.has(id) || filterSet.has(testMethodOf(id))

// Every mutation belongs to exactly one group and every group reports a result,
// so no slot is still null by the time the results are assembled — this is a
// type guard for the compiler rather than a runtime narrowing.
// Stryker disable next-line ConditionalExpression: no null slots remain.
const isPresent = <T>(value: T | null): value is T => value !== null

// A single-purpose write port so a caller can inject a stub in tests instead
// of spying on the process-global stdout stream. Defaults to the real
// stdout, so run.ts needs no change to keep its current behaviour.
export type OutputSink = (text: string) => void

const writeToStdout: OutputSink = text => {
  process.stdout.write(text)
}

// @jsforce/jsforce-node sets `error.message` to the entire raw response body
// when it is neither a parseable JSON error nor text/html (see
// http-api.js), so any org/network failure detail is unbounded. Bounds every
// such detail this service renders — the sync-transport fallback reason and
// the rollback failure cause alike. The sibling compile-diagnosis sanitizer
// never needs a bound because its inputs are already short.
const MAX_ORG_ERROR_DETAIL_LENGTH = 200

// Emitted when the progress bar cannot be torn down on the failure path. The
// rollback that follows matters more, so this is reported and stepped over.
const PROGRESS_TEARDOWN_WARNING =
  'Warning: could not tear down the progress display. Cause:'

// Truncates by code point, not by UTF-16 index, so a surrogate pair is
// never split.
const truncateForDisplay = (value: string, maxLength: number): string => {
  const codePoints = Array.from(value)
  return codePoints.length <= maxLength
    ? value
    : `${codePoints.slice(0, maxLength).join('')}…`
}

interface MutationLoopContext {
  apexClass: ApexClass
  mutations: ApexMutation[]
  groups: MutationGroup[]
  mutantGenerator: MutantGenerator
  tokenStream: CommonTokenStream
  testMethodsPerLine: Map<number, Set<TestMethodId>>
  apexTestRunner: ApexTestRunner
  apexClassRepository: ApexClassRepository
  retainedTestClassNames: string[]
}

export class MutationTestingService {
  protected readonly apexClassName: string
  protected readonly apexTestClassNames: string[]
  protected readonly dryRun: boolean
  protected readonly includeMutators: string[] | undefined
  protected readonly excludeMutators: string[] | undefined
  protected readonly includeTestMethods: string[] | undefined
  protected readonly excludeTestMethods: string[] | undefined
  private readonly skipPatterns: SkipPattern[]
  private readonly allowedLines: Set<number> | undefined
  private readonly mutationGroupingEnabled: boolean
  private readonly testClassOrigins: TestClassOrigins | undefined
  // Assigned by fetchApexClass before any reader runs; no meaningful seed.
  private apexClassContent!: string

  constructor(
    protected readonly progress: Progress,
    protected readonly spinner: Spinner,
    protected readonly connection: Connection,
    {
      apexClassName,
      apexTestClassNames,
      dryRun,
      includeMutators,
      excludeMutators,
      includeTestMethods,
      excludeTestMethods,
      skipPatterns,
      lines,
      mutationGrouping,
      testClassOrigins,
    }: ApexMutationParameter,
    protected readonly messages: Messages<string>,
    private readonly outputSink: OutputSink = writeToStdout
  ) {
    this.apexClassName = apexClassName
    this.apexTestClassNames = apexTestClassNames
    this.dryRun = dryRun ?? false
    this.includeMutators = includeMutators
    this.excludeMutators = excludeMutators
    this.includeTestMethods = includeTestMethods
    this.excludeTestMethods = excludeTestMethods
    this.skipPatterns = ConfigReader.compileSkipPatterns(skipPatterns)
    this.allowedLines = ConfigReader.parseLineRanges(lines)
    this.mutationGroupingEnabled = mutationGrouping ?? false
    this.testClassOrigins = testClassOrigins
  }

  // One canonical spelling of the joined test class perimeter, so every log
  // line, message and spinner text within this service renders it identically.
  private get testClassPerimeter(): string {
    return this.apexTestClassNames.join(', ')
  }

  public async process(): Promise<ApexMutationTestResult> {
    const { apexClassRepository, apexTestRunner, apexSettingsRepository } =
      this.createAdapters()
    const apexClass = await this.fetchApexClass(apexClassRepository)
    const typeAnalysis = await this.discoverTypes(
      apexClass,
      apexClassRepository
    )

    const deployTime = await this.verifyCompilation(
      apexClass,
      apexClassRepository
    )

    const coverageStrategy = await this.selectCoverageStrategy(
      apexSettingsRepository
    )
    const { testMethodsPerLine, testTime, retainedTestClassNames } =
      await this.runBaselineTests(apexTestRunner, coverageStrategy)
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
      return this.buildDryRunResult(
        apexClass,
        mutations,
        retainedTestClassNames
      )
    }

    const groups = await this.planGroups(mutations, testMethodsPerLine)
    this.displayTimeEstimate(
      deployTime,
      testTime,
      mutations.length,
      groups.length
    )

    return this.executeMutationLoopWithRollback({
      apexClass,
      mutations,
      groups,
      mutantGenerator,
      tokenStream,
      testMethodsPerLine,
      apexTestRunner,
      apexClassRepository,
      retainedTestClassNames,
    })
  }

  private async planGroups(
    mutations: ApexMutation[],
    testMethodsPerLine: Map<number, Set<TestMethodId>>
  ): Promise<MutationGroup[]> {
    if (!this.mutationGroupingEnabled) {
      // No grouping: one mutation per group. Inlined here rather than going
      // through groupMutations to avoid building the conflict graph for the
      // common (default-off) case.
      return mutations.map(m => ({
        mutations: [m],
        // extractCoveredLines guarantees the line is in the map.
        testMethods: testMethodsPerLine.get(m.target.startToken.line)!,
      }))
    }

    this.spinner.start(
      `Grouping ${mutations.length} mutations to minimize deployments`,
      undefined,
      { stdout: true }
    )
    const {
      groups: dsaturGroups,
      lowerBound,
      internals,
    } = groupMutationsWithInternals(mutations, testMethodsPerLine)

    let groups = dsaturGroups
    const exact = solveColoring({
      adjacency: internals.adjacency,
      n: mutations.length,
      lowerBound,
      dsaturColors: dsaturGroups.length,
      witness: internals.witness,
      dsaturColoring: internals.coloring,
    })
    const decision = decideExactOutcome(exact, dsaturGroups.length)
    const exactSuffix = decision.suffix
    if (decision.useGroups === 'exact') {
      groups = assembleGroups(mutations, internals.tests, exact.coloring)
    }

    // Division is safe: generateMutations throws when mutations is empty,
    // so planGroups is never reached with mutations.length === 0.
    const savingsPct = Math.round((1 - groups.length / mutations.length) * 100)
    this.spinner.stop(
      this.messages.getMessage('info.groupingPlan', [
        String(mutations.length),
        String(groups.length),
        String(savingsPct),
        String(lowerBound),
        exactSuffix,
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

  private filterTestMethods(
    testMethodsPerLine: Map<number, Set<TestMethodId>>
  ): Map<number, Set<TestMethodId>> {
    const filterSet = this.includeTestMethods
      ? new Set(this.includeTestMethods)
      : this.excludeTestMethods
        ? new Set(this.excludeTestMethods)
        : undefined

    if (!filterSet) {
      return testMethodsPerLine
    }

    const isInclude = Boolean(this.includeTestMethods)

    const filteredPerLine = new Map<number, Set<TestMethodId>>()
    for (const [line, methods] of testMethodsPerLine) {
      const filtered = new Set(
        [...methods].filter(m =>
          isInclude ? matchesFilter(m, filterSet) : !matchesFilter(m, filterSet)
        )
      )
      if (filtered.size > 0) {
        filteredPerLine.set(line, filtered)
      }
    }
    return filteredPerLine
  }

  private createAdapters() {
    return {
      apexClassRepository: new ApexClassRepository(this.connection),
      apexTestRunner: new ApexTestRunner(this.connection, {
        onSyncFallback: error => this.warnSyncFallback(error),
      }),
      apexSettingsRepository: new ApexSettingsRepository(this.connection),
    }
  }

  // Uses spinner.pause, not the start/stop pair announceSkips relies on:
  // oclif's stop() no-ops when no task is running, and start() replaces the
  // current task without stopping it, so that idiom would silently swallow a
  // later 'Original tests passed'. pause() is safe whether or not a task is
  // active. The reason is org/network-controlled and unbounded — sanitized
  // the same way as the compile-diagnosis path, then length-bounded, before
  // it reaches the injected output sink.
  private warnSyncFallback(error: Error): void {
    this.spinner.pause(() => {
      const reason = truncateForDisplay(
        sanitizeForDisplay(error.message),
        MAX_ORG_ERROR_DETAIL_LENGTH
      )
      this.outputSink(
        `${this.messages.getMessage('info.syncTransportFallback', [reason])}\n`
      )
    })
  }

  private async selectCoverageStrategy(
    apexSettingsRepository: ApexSettingsRepository
  ): Promise<CoverageStrategy> {
    const aggregateOnly = await apexSettingsRepository.isAggregateCoverageOnly()
    return aggregateOnly
      ? new AggregateCoverageStrategy(this.apexClassName)
      : new PerTestCoverageStrategy(this.apexClassName)
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

  private async runBaselineTests(
    apexTestRunner: ApexTestRunner,
    coverageStrategy: CoverageStrategy
  ): Promise<{
    testMethodsPerLine: Map<number, Set<TestMethodId>>
    testTime: number
    retainedTestClassNames: string[]
  }> {
    this.spinner.start(
      `Executing "${this.testClassPerimeter}" tests to get coverage`,
      undefined,
      { stdout: true }
    )
    const { result: baseline, durationMs: testTime } = await timeExecution(() =>
      apexTestRunner.getTestMethodsPerLines(
        this.apexTestClassNames,
        coverageStrategy
      )
    )
    this.assertUsableBaseline(baseline)
    const testMethodsPerLine = this.filterTestMethods(
      baseline.testMethodsPerLine
    )
    const retainedTestClassNames = this.reducePerimeterFromBaseline(
      baseline,
      testMethodsPerLine,
      coverageStrategy
    )
    return { testMethodsPerLine, testTime, retainedTestClassNames }
  }

  // Both aborts stop the spinner before throwing — losing either leaves a
  // spinner running on the failure path. A CompileFail row counts toward
  // testsRan, so an all-CompileFail baseline never reaches this second
  // guard; it is caught downstream by the empty-perimeter guard in
  // reducePerimeterFromBaseline instead.
  private assertUsableBaseline(baseline: BaselineTestResult): void {
    const { outcome, testsRan, otherFailureCount } = baseline
    if (otherFailureCount > 0) {
      this.spinner.stop()
      const compileSentences = formatSkippedTestClasses(
        this.toCompileSkips(baseline.compileFailures),
        this.messages
      )
      const compileDetail =
        compileSentences.length > 0 ? `${compileSentences.join('\n')}\n` : ''
      throw new Error(
        `Original tests failed! Cannot proceed with mutation testing.\n` +
          `Test outcome: ${outcome}\n` +
          `Failing tests: ${otherFailureCount}\n` +
          compileDetail
      )
    }

    if (testsRan === 0) {
      this.spinner.stop()
      throw new Error(
        `No tests were executed! Check that:\n` +
          `- Test class(es) '${this.testClassPerimeter}' exist\n` +
          `- Test methods have @IsTest annotation\n` +
          `- Test class(es) are properly deployed`
      )
    }
  }

  private stopBaselineSpinner(coverageStrategy: CoverageStrategy): void {
    this.spinner.stop(
      coverageStrategy.fidelity === 'aggregate'
        ? `Original tests passed (${this.messages.getMessage('info.aggregatedCoverageOnly')})`
        : 'Original tests passed'
    )
  }

  // Stops the same spinner without claiming a pass, for the path where every
  // class failed to compile: no test ran, so there is nothing to have passed.
  private abandonBaselineSpinner(): void {
    this.spinner.stop()
  }

  // The two drops and the guard, in order: a class that cannot compile never
  // ran a test, so it is dropped before zero-contribution is even computed.
  // If every class drops here, error.noUsableTestClass is the truthful
  // failure — error.noCoverage would name a perimeter that simply never
  // compiled, not one that ran and covered nothing.
  //
  // Three constraints pin the spinner handling, and they only reconcile if the
  // TEXT is conditional rather than the ordering. The notices must precede the
  // throw, or an all-CompileFail run never says which classes broke. The
  // spinner must stop before the notices, because announcing stops it too and
  // stopping an already-stopped spinner renders nothing — that would swallow
  // the pass line whenever only some classes failed. And the pass text must
  // not appear when nothing survived: an all-CompileFail baseline reports
  // otherFailureCount === 0 and testsRan > 0, since CompileFail rows count
  // toward testsRan, so it would claim a pass that never happened.
  private reducePerimeterFromBaseline(
    baseline: BaselineTestResult,
    testMethodsPerLine: Map<number, Set<TestMethodId>>,
    coverageStrategy: CoverageStrategy
  ): string[] {
    const compileSkips = this.toCompileSkips(baseline.compileFailures)
    const compileSentences = formatSkippedTestClasses(
      compileSkips,
      this.messages
    )
    const compiling = reducePerimeter(this.apexTestClassNames, compileSkips)
    if (compiling.length === 0) {
      this.abandonBaselineSpinner()
      this.announceSkips(compileSentences)
      throw this.messages.createError('error.noUsableTestClass', [
        this.apexClassName,
        compileSentences.join('\n'),
      ])
    }
    this.stopBaselineSpinner(coverageStrategy)
    this.announceSkips(compileSentences)

    const silent =
      coverageStrategy.fidelity === 'per-test'
        ? this.findZeroContributionTestClasses(compiling, testMethodsPerLine)
        : []
    this.announceSkips(formatSkippedTestClasses(silent, this.messages))
    return reducePerimeter(compiling, silent)
  }

  // Walking the perimeter (rather than the failures) emits the perimeter
  // entry's own spelling, renders warnings in perimeter order like every
  // other drop, and avoids a non-null assertion on a lookup that can only
  // miss in a state the platform cannot produce.
  private toCompileSkips(
    failures: BaselineCompileFailure[]
  ): SkippedTestClass[] {
    const detailByKey = new Map(
      failures.map(failure => [
        failure.className.toLowerCase(),
        failure.message,
      ])
    )
    const skips = this.apexTestClassNames.flatMap(name => {
      const detail = detailByKey.get(name.toLowerCase())
      return detail === undefined
        ? []
        : [{ className: name, reason: 'does-not-compile' as const, detail }]
    })
    return attachSuiteProvenance(skips, this.testClassOrigins)
  }

  // AggregateCoverageStrategy has no per-test attribution, so this diff
  // only makes sense — and is only computed — under per-test fidelity.
  // Diffs against the compile-reduced perimeter, so a class that failed to
  // compile is never also reported as contributing nothing. No namespace
  // guard is needed on the join below: assessPerimeter already dropped every
  // namespaced entry before the perimeter reached this service, so every
  // remaining class is local and `test.apexClass.fullName` on the org
  // matches the perimeter spelling — the case-folded join cannot
  // systematically miss it.
  private findZeroContributionTestClasses(
    perimeter: string[],
    testMethodsPerLine: Map<number, Set<TestMethodId>>
  ): SkippedTestClass[] {
    const contributingClasses = new Set(
      [...testMethodsPerLine.values()]
        .flatMap(methods => [...methods])
        .map(id => testClassOf(id).toLowerCase())
    )
    const silent = perimeter
      .filter(name => !contributingClasses.has(name.toLowerCase()))
      .map(className => ({ className, reason: 'no-coverage' as const }))
    return attachSuiteProvenance(silent, this.testClassOrigins)
  }

  private announceSkips(sentences: string[]): void {
    for (const sentence of sentences) {
      this.spinner.start(sentence, undefined, { stdout: true })
      this.spinner.stop()
    }
  }

  private extractCoveredLines(
    testMethodsPerLine: Map<number, Set<TestMethodId>>
  ): Set<number> {
    const coveredLines = new Set(testMethodsPerLine.keys())
    if (coveredLines.size === 0) {
      throw new Error(
        this.messages.getMessage('error.noCoverage', [
          this.apexClassName,
          this.testClassPerimeter,
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
    mutations: ApexMutation[],
    retainedTestClassNames: string[]
  ): ApexMutationTestResult {
    return {
      sourceFile: this.apexClassName,
      sourceFileContent: apexClass.Body,
      testFiles: retainedTestClassNames,
      mutants: mutations.map(mutation => ({
        id: `${this.apexClassName}-${mutation.target.startToken.line}-${mutation.target.startToken.charPositionInLine}-${mutation.target.startToken.tokenIndex}-${Date.now()}`,
        mutatorName: mutation.mutationName,
        status: 'Pending' as const,
        location: calculateMutationPosition(mutation),
        replacement: mutation.replacement,
        original: extractMutationOriginalText(mutation, this.apexClassContent),
      })),
    }
  }

  private async executeMutationLoop(
    context: MutationLoopContext
  ): Promise<ApexMutationTestResult> {
    const {
      apexClass,
      mutations,
      groups,
      mutantGenerator,
      tokenStream,
      testMethodsPerLine,
      apexTestRunner,
      apexClassRepository,
      retainedTestClassNames,
    } = context

    this.progress.start(
      mutations.length,
      { info: 'Starting mutation testing' },
      {
        title: 'MUTATION TESTING PROGRESS',
        format: '%s | {bar} | {value}/{total} {info}',
      }
    )

    const executor = new GroupExecutor(
      apexClass,
      this.apexClassName,
      this.apexClassContent,
      tokenStream,
      testMethodsPerLine,
      mutantGenerator,
      apexTestRunner,
      apexClassRepository,
      this.progress,
      this.messages
    )

    const indexByMutation = new Map(mutations.map((m, i) => [m, i]))
    // Pre-filling with null only makes the holes explicit: every index is
    // written below, and null slots and array holes are both skipped
    // identically by the `filter` at the end.
    type MutantResult = ApexMutationTestResult['mutants'][number]
    // Stryker disable next-line ArrayDeclaration: pre-fill is not observable.
    const orderedResults: Array<MutantResult | null> = new Array(
      mutations.length
    ).fill(null)
    let completed = 0
    const loopStartTime = performance.now()

    for (const group of groups) {
      const mutantResults = await executor.evaluate(
        group,
        completed,
        loopStartTime,
        mutations.length
      )
      // Stryker disable next-line EqualityOperator: an extra iteration reads
      // `group.mutations[length]` as undefined, whose index lookup writes a
      // non-index property that `filter` never visits.
      for (let i = 0; i < group.mutations.length; ++i) {
        const idx = indexByMutation.get(group.mutations[i])!
        orderedResults[idx] = mutantResults[i]
      }
      completed += group.mutations.length
    }

    this.progress.finish({ info: 'All mutations evaluated' })
    return {
      sourceFile: this.apexClassName,
      sourceFileContent: apexClass.Body,
      testFiles: retainedTestClassNames,
      // Stryker disable next-line MethodExpression: no null slots remain, so
      // filtering and not filtering yield the same array — see `isPresent`.
      mutants: orderedResults.filter(isPresent),
    }
  }

  // The org holds a mutated body from the first group deploy until rollback
  // redeploys the original, so the restore must survive every exit of the loop,
  // not only the resolving one. Not a `finally`: a finally that raises replaces
  // the loop's rejection with its own, destroying the root cause.
  private async executeMutationLoopWithRollback(
    context: MutationLoopContext
  ): Promise<ApexMutationTestResult> {
    let result: ApexMutationTestResult
    try {
      result = await this.executeMutationLoop(context)
    } catch (loopError: unknown) {
      // The bar the loop owns stopped moving when the loop died. Tearing it
      // down here, next to the failure it answers, leaves a single renderer on
      // stdout before the rollback spinner starts.
      this.stopProgress()
      throw await this.rollbackAfterLoopFailure(loopError, context)
    }
    await this.rollback(context.apexClass, context.apexClassRepository)
    return result
  }

  // Reaching the restore is the whole point of the guard, so nothing between
  // the loop's rejection and the restore attempt may pre-empt it. Tearing the
  // bar down writes to stdout, which can fail when the stream is gone, so the
  // failure is reported through the same sink as the other non-fatal warnings
  // instead of propagating and skipping the restore.
  private stopProgress(): void {
    try {
      this.progress.stop()
    } catch (error: unknown) {
      this.outputSink(
        `${PROGRESS_TEARDOWN_WARNING} ${sanitizeForDisplay(String(error))}\n`
      )
    }
  }

  // Returns the error for the caller to throw rather than throwing itself, so
  // the `throw` stays at the call site and the method keeps a nameable return
  // type instead of a `never` that TypeScript does not narrow through `await`.
  private async rollbackAfterLoopFailure(
    loopError: unknown,
    context: MutationLoopContext
  ): Promise<unknown> {
    try {
      await this.rollback(context.apexClass, context.apexClassRepository)
      return loopError
    } catch (rollbackError: unknown) {
      // The loop failure is the root cause and leads the message; the rollback
      // failure is appended so "the class is still mutated on the org" reaches
      // stderr as well as --json. String(rollbackError) is deliberately
      // unguarded: rollback only ever raises the Error it builds itself, so an
      // instanceof guard would add an arm no test could reach.
      //
      // Flattening to a plain Error drops any name/code/actions the loop error
      // carried, which SfCommandError.from reads off the thrown error rather
      // than the cause chain. That is safe only because org errors never escape
      // the loop — GroupExecutor classifies deploy and test failures per mutant
      // and rethrows nothing — so a future throw of a structured error out of
      // the loop breaks this assumption.
      const loopMessage =
        loopError instanceof Error ? loopError.message : String(loopError)
      return new Error(`${loopMessage}\n${String(rollbackError)}`, {
        cause: loopError,
      })
    }
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
      await apexClassRepository.update(apexClass, SKIP_TESTS)
      this.spinner.stop('Done')
    } catch (error: unknown) {
      this.spinner.stop(
        `Rollback FAILED — '${this.apexClassName}' remains in a mutated state on the target org. Redeploy the original class manually.`
      )
      // The cause is the raw org/network failure, so it is unbounded and can
      // carry control bytes — folded and length-bounded like every other
      // org-supplied detail this service renders. The actionable sentence goes
      // last so no amount of org text can push it off screen.
      const cause = truncateForDisplay(
        sanitizeForDisplay(
          error instanceof Error ? error.message : String(error)
        ),
        MAX_ORG_ERROR_DETAIL_LENGTH
      )
      throw new Error(
        `Rollback of '${this.apexClassName}' failed. Underlying cause: ${cause}. The class on the target org is still in a mutated state. Redeploy manually.`
      )
    }
  }
}
