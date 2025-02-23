import { TestResult } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import { Progress, Spinner } from '@salesforce/sf-plugins-core'
import { ApexClassRepository } from '../adapter/apexClassRepository.js'
import { ApexTestRunner } from '../adapter/apexTestRunner.js'
import { ApexClass } from '../type/ApexClass.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { ApexMutationTestResult } from '../type/ApexMutationTestResult.js'
import { MutantGenerator } from './mutantGenerator.js'

export class MutationTestingService {
  protected readonly apexClassName: string
  protected readonly apexClassTestName: string

  constructor(
    protected readonly progress: Progress,
    protected readonly spinner: Spinner,
    protected readonly connection: Connection,
    {
      apexClassName,
      apexClassTestName,
    }: { apexClassName: string; apexClassTestName: string }
  ) {
    this.apexClassName = apexClassName
    this.apexClassTestName = apexClassTestName
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
    this.spinner.stop('Done')

    this.spinner.start(
      `Generating mutants for "${this.apexClassName}" ApexClass`,
      undefined,
      {
        stdout: true,
      }
    )
    const mutantGenerator = new MutantGenerator()
    const mutations = mutantGenerator.compute(apexClass.Body)
    const mutationResults: ApexMutationTestResult = {
      sourceFile: this.apexClassName,
      sourceFileContent: apexClass.Body,
      testFile: this.apexClassTestName,
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

      this.progress.update(mutationCount, {
        info: `Deploying "${mutation.replacement}" mutation at line ${mutation.token.symbol.line}`,
      })

      let progressMessage
      try {
        await apexClassRepository.update({
          Id: apexClass.Id as string,
          Body: mutatedVersion,
        })

        this.progress.update(mutationCount, {
          info: `Running tests for "${mutation.replacement}" mutation at line ${mutation.token.symbol.line}`,
        })
        const testResult: TestResult = await apexTestRunner.run(
          this.apexClassTestName
        )

        const mutantResult = this.buildMutantResult(mutation, testResult)
        mutationResults.mutants.push(mutantResult)

        progressMessage = `Mutation result: ${testResult.summary.outcome === 'Pass' ? 'zombie' : 'mutant killed'}`
      } catch {
        progressMessage = `Issue while computing "${mutation.replacement}" mutation at line ${mutation.token.symbol.line}`
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
    return (
      (mutationResult.mutants.filter(mutant => mutant.status === 'Killed')
        .length /
        mutationResult.mutants.length) *
        100 || 0
    )
  }

  private buildMutantResult(mutation: ApexMutation, testResult: TestResult) {
    const token = mutation.token
    // TODO Handle NoCoverage
    const mutationStatus: 'Killed' | 'Survived' | 'NoCoverage' =
      testResult.summary.outcome === 'Pass' ? 'Survived' : 'Killed'

    return {
      id: `${this.apexClassName}-${token.symbol.line}-${token.symbol.charPositionInLine}-${token.symbol.tokenIndex}-${Date.now()}`,
      mutatorName: mutation.mutationName,
      status: mutationStatus,
      location: {
        start: {
          line: token.symbol.line,
          column: token.symbol.charPositionInLine,
        },
        end: {
          line: token.symbol.line,
          column:
            token.symbol.charPositionInLine + mutation.replacement?.length || 0,
        },
      },
      replacement: mutation.replacement,
      original: token.text,
    }
  }
}
