import { TestResult } from '@salesforce/apex-node'
import { Connection, Messages } from '@salesforce/core'
import { Progress, Spinner } from '@salesforce/sf-plugins-core'
import { ApexClassRepository } from '../adapter/apexClassRepository.js'
import { ApexTestRunner } from '../adapter/apexTestRunner.js'
import { SObjectDescribeRepository } from '../adapter/sObjectDescribeRepository.js'
import { ApexClass } from '../type/ApexClass.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { ApexMutationParameter } from '../type/ApexMutationParameter.js'
import { ApexMutationTestResult } from '../type/ApexMutationTestResult.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { ConfigReader, type RE2Instance } from './configReader.js'
import { MutantGenerator } from './mutantGenerator.js'
import { formatDuration, timeExecution } from './timeUtils.js'
import { TypeDiscoverer } from './typeDiscoverer.js'
import { ApexClassTypeMatcher, SObjectTypeMatcher } from './typeMatcher.js'

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
  }

  public async process(): Promise<ApexMutationTestResult> {
    const { apexClassRepository, apexTestRunner } = this.createAdapters()
    const apexClass = await this.fetchApexClass(apexClassRepository)
    const typeRegistry = await this.discoverTypes(
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
    const { mutations, mutantGenerator } = this.generateMutations(
      apexClass,
      coveredLines,
      typeRegistry
    )

    this.displayTimeEstimate(deployTime, testTime, mutations.length)

    if (this.dryRun) {
      return this.buildDryRunResult(apexClass, mutations)
    }

    const result = await this.executeMutationLoop(
      apexClass,
      mutations,
      mutantGenerator,
      testMethodsPerLine,
      apexTestRunner,
      apexClassRepository
    )
    await this.rollback(apexClass, apexClassRepository)
    return result
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

    const location = this.calculateMutationPosition(
      mutation,
      this.apexClassContent
    )
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

  private calculateMutationPosition(
    mutation: ApexMutation,
    sourceContent: string
  ): {
    start: { line: number; column: number }
    end: { line: number; column: number }
  } {
    const start = mutation.target.startToken
    const end = mutation.target.endToken

    if (start.startIndex !== undefined && end.stopIndex !== undefined) {
      const startPos = this.convertAbsoluteIndexToLineColumn(
        sourceContent,
        start.startIndex
      )
      const endPos = this.convertAbsoluteIndexToLineColumn(
        sourceContent,
        end.stopIndex + 1
      )

      return { start: startPos, end: endPos }
    }

    throw new Error(
      `Failed to calculate position for mutation: ${mutation.mutationName}`
    )
  }

  private convertAbsoluteIndexToLineColumn(
    sourceContent: string,
    absoluteIndex: number
  ): { line: number; column: number } {
    const textBeforeIndex = sourceContent.substring(0, absoluteIndex)
    const lines = textBeforeIndex.split('\n')

    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
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
  ): Promise<TypeRegistry> {
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

    const typeRegistry = await typeDiscoverer.analyze(apexClass.Body)
    this.spinner.stop('Done')
    return typeRegistry
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
    typeRegistry: TypeRegistry
  ): { mutations: ApexMutation[]; mutantGenerator: MutantGenerator } {
    this.spinner.start(
      `Generating mutants for "${this.apexClassName}" ApexClass`,
      undefined,
      { stdout: true }
    )
    const mutantGenerator = new MutantGenerator()
    const mutatorFilter = this.buildMutatorFilter()
    const mutations = mutantGenerator.compute(
      apexClass.Body,
      coveredLines,
      typeRegistry,
      mutatorFilter,
      this.skipPatterns,
      this.allowedLines
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
    return { mutations, mutantGenerator }
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
    mutationCount: number
  ): void {
    const totalEstimateMs = (deployTime + testTime) * mutationCount
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
        location: this.calculateMutationPosition(mutation, apexClass.Body),
        replacement: mutation.replacement,
        original: this.extractMutationOriginalText(mutation),
      })),
    }
  }

  private async executeMutationLoop(
    apexClass: ApexClass,
    mutations: ApexMutation[],
    mutantGenerator: MutantGenerator,
    testMethodsPerLine: Map<number, Set<string>>,
    apexTestRunner: ApexTestRunner,
    apexClassRepository: ApexClassRepository
  ): Promise<ApexMutationTestResult> {
    const mutationResults: ApexMutationTestResult = {
      sourceFile: this.apexClassName,
      sourceFileContent: apexClass.Body,
      testFile: this.apexTestClassName,
      mutants: [],
    }

    this.progress.start(
      mutations.length,
      { info: 'Starting mutation testing' },
      {
        title: 'MUTATION TESTING PROGRESS',
        format: '%s | {bar} | {value}/{total} {info}',
      }
    )

    let mutationCount = 0
    const loopStartTime = performance.now()
    for (const mutation of mutations) {
      const remainingText = this.formatRemainingTime(
        loopStartTime,
        mutationCount,
        mutations.length
      )

      this.progress.update(mutationCount, {
        info: `${remainingText}Deploying "${mutation.replacement}" mutation at line ${mutation.target.startToken.line}`,
      })

      const testMethods = testMethodsPerLine.get(
        mutation.target.startToken.line
      )
      if (testMethods) {
        this.progress.update(mutationCount, {
          info: `${remainingText}Running ${testMethods.size} tests methods for "${mutation.replacement}" mutation at line ${mutation.target.startToken.line}`,
        })
      }

      const { mutantResult, progressMessage } = await this.evaluateMutation(
        mutation,
        mutantGenerator,
        apexClass,
        testMethodsPerLine,
        apexTestRunner,
        apexClassRepository
      )
      mutationResults.mutants.push(mutantResult)

      ++mutationCount
      const updatedRemainingText = this.formatRemainingTime(
        loopStartTime,
        mutationCount,
        mutations.length
      )
      this.progress.update(mutationCount, {
        info: `${updatedRemainingText}${progressMessage}`,
      })
    }

    this.progress.finish({ info: 'All mutations evaluated' })
    return mutationResults
  }

  private async evaluateMutation(
    mutation: ApexMutation,
    mutantGenerator: MutantGenerator,
    apexClass: ApexClass,
    testMethodsPerLine: Map<number, Set<string>>,
    apexTestRunner: ApexTestRunner,
    apexClassRepository: ApexClassRepository
  ): Promise<{
    mutantResult: ApexMutationTestResult['mutants'][number]
    progressMessage: string
  }> {
    const mutatedVersion = mutantGenerator.mutate(mutation)
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
      const location = this.calculateMutationPosition(
        mutation,
        this.apexClassContent
      )
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
    try {
      this.spinner.start(
        `Rolling back "${this.apexClassName}" ApexClass to its original state`,
        undefined,
        { stdout: true }
      )
      await apexClassRepository.update(apexClass)
      this.spinner.stop('Done')
    } catch {
      this.spinner.stop('Class not rolled back, please do it manually')
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
