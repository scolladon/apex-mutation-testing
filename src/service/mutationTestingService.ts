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
import { formatDuration, timeExecution } from './timeUtils.js'
import { type TypeAnalysisResult, TypeDiscoverer } from './typeDiscoverer.js'
import { ApexClassTypeMatcher, SObjectTypeMatcher } from './typeMatcher.js'

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

    const groups = await this.planGroups(mutations, testMethodsPerLine)
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

  private async planGroups(
    mutations: ApexMutation[],
    testMethodsPerLine: Map<number, Set<string>>
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
        apexTestRunner.getTestMethodsPerLines(
          this.apexTestClassName,
          this.apexClassName
        )
      )
    const {
      outcome,
      testsRan,
      failing,
      testMethodsPerLine,
      aggregatedCoverageOnly,
    } = baselineResult

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

    this.spinner.stop(
      aggregatedCoverageOnly
        ? `Original tests passed (${this.messages.getMessage('info.aggregatedCoverageOnly')})`
        : 'Original tests passed'
    )
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
        location: calculateMutationPosition(mutation),
        replacement: mutation.replacement,
        original: extractMutationOriginalText(mutation, this.apexClassContent),
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

    const executor = new GroupExecutor(
      apexClass,
      this.apexClassName,
      this.apexTestClassName,
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
    const orderedResults: Array<
      ApexMutationTestResult['mutants'][number] | null
    > = new Array(mutations.length).fill(null)
    let completed = 0
    const loopStartTime = performance.now()

    for (const group of groups) {
      const mutantResults = await executor.evaluate(
        group,
        completed,
        loopStartTime,
        mutations.length
      )
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
      testFile: this.apexTestClassName,
      mutants: orderedResults.filter(
        (r): r is ApexMutationTestResult['mutants'][number] => r !== null
      ),
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
}
