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
import { ApexTypeResolver } from './apexTypeResolver.js'
import { MutantGenerator } from './mutantGenerator.js'

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
  private apexClassContent: string = ''

  constructor(
    protected readonly progress: Progress,
    protected readonly spinner: Spinner,
    protected readonly connection: Connection,
    { apexClassName, apexTestClassName }: ApexMutationParameter,
    protected readonly messages: Messages<string>
  ) {
    this.apexClassName = apexClassName
    this.apexTestClassName = apexTestClassName
  }

  public async process() {
    const apexClassRepository = new ApexClassRepository(this.connection)
    const apexTestRunner = new ApexTestRunner(this.connection)
    this.spinner.start(
      `Fetching "${this.apexClassName}" ApexClass content`,
      undefined,
      {
        stdout: true,
      }
    )

    const apexClass: ApexClass = (await apexClassRepository.read(
      this.apexClassName
    )) as unknown as ApexClass

    this.apexClassContent = apexClass.Body

    this.spinner.stop('Done')

    this.spinner.start(
      `Analyzing class dependencies for "${this.apexClassName}"`,
      undefined,
      {
        stdout: true,
      }
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

    const typeResolver = new ApexTypeResolver(
      apexClassTypes,
      standardEntityTypes,
      customObjectTypes
    )
    this.spinner.stop('Done')

    this.spinner.start(
      `Describing sObject field types for "${this.apexClassName}"`,
      undefined,
      { stdout: true }
    )
    const sObjectDescribeRepository = new SObjectDescribeRepository(
      this.connection
    )
    const allSObjectNames = [...standardEntityTypes, ...customObjectTypes]
    await sObjectDescribeRepository.describe(allSObjectNames)
    this.spinner.stop('Done')

    this.spinner.start(`Testing original code"`, undefined, {
      stdout: true,
    })

    const { outcome, testsRan, failing, testMethodsPerLine } =
      await apexTestRunner.getTestMethodsPerLines(this.apexTestClassName)

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

    const coveredLines = new Set(testMethodsPerLine.keys())

    if (coveredLines.size === 0) {
      throw new Error(
        this.messages.getMessage('error.noCoverage', [
          this.apexClassName,
          this.apexTestClassName,
        ])
      )
    }

    this.spinner.start(
      `Generating mutants for "${this.apexClassName}" ApexClass`,
      undefined,
      {
        stdout: true,
      }
    )
    const mutantGenerator = new MutantGenerator()
    const mutations = mutantGenerator.compute(
      apexClass.Body,
      coveredLines,
      typeResolver,
      sObjectDescribeRepository
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

    const mutationResults: ApexMutationTestResult = {
      sourceFile: this.apexClassName,
      sourceFileContent: apexClass.Body,
      testFile: this.apexTestClassName,
      mutants: [],
    }
    this.spinner.stop(`${mutations.length} mutations generated`)

    this.progress.start(
      mutations.length,
      { info: 'Starting mutation testing' },
      {
        title: 'MUTATION TESTING PROGRESS',
        format: '%s | {bar} | {value}/{total} {info}',
      }
    )

    let mutationCount = 0
    for (const mutation of mutations) {
      const mutatedVersion = mutantGenerator.mutate(mutation)

      const targetInfo: TokenTargetInfo = {
        line: mutation.target.startToken.line,
        column: mutation.target.startToken.charPositionInLine,
        tokenIndex: mutation.target.startToken.tokenIndex,
        text: mutation.target.text,
      }

      this.progress.update(mutationCount, {
        info: `Deploying "${mutation.replacement}" mutation at line ${targetInfo.line}`,
      })

      let progressMessage
      try {
        await apexClassRepository.update({
          Id: apexClass.Id as string,
          Body: mutatedVersion,
        })

        const testMethods = testMethodsPerLine.get(targetInfo.line)!

        this.progress.update(mutationCount, {
          info: `Running ${testMethods.size} tests methods for "${mutation.replacement}" mutation at line ${targetInfo.line}`,
        })
        const testResult: TestResult = await apexTestRunner.runTestMethods(
          this.apexTestClassName,
          testMethods
        )

        const mutantResult = this.buildMutantResult(
          mutation,
          testResult,
          targetInfo
        )
        mutationResults.mutants.push(mutantResult)

        progressMessage = `Mutation result: ${testResult.summary.outcome === 'Passed' ? 'zombie' : 'mutant killed'}`
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

        mutationResults.mutants.push({
          id: `${this.apexClassName}-${targetInfo.line}-${targetInfo.column}-${targetInfo.tokenIndex}-${Date.now()}`,
          mutatorName: mutation.mutationName,
          status: classification.status,
          ...(classification.statusReason && {
            statusReason: classification.statusReason,
          }),
          location,
          replacement: mutation.replacement,
          original: originalText,
        })
        progressMessage = classification.progressMessage
      }
      ++mutationCount
      this.progress.update(mutationCount, {
        info: progressMessage,
      })
    }
    this.progress.finish({
      info: `All mutations evaluated`,
    })

    try {
      this.spinner.start(
        `Rolling back "${this.apexClassName}" ApexClass to its original state`,
        undefined,
        {
          stdout: true,
        }
      )
      await apexClassRepository.update(apexClass)
      this.spinner.stop('Done')
    } catch {
      this.spinner.stop('Class not rolled back, please do it manually')
    }

    return mutationResults
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
