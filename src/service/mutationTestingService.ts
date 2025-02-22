import { TestResult } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import { ApexClassRepository } from '../adapter/apexClassRepository.js'
import { ApexTestRunner } from '../adapter/apexTestRunner.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { ApexMutationTestResult } from '../type/ApexMutationTestResult.js'
import { MutantGenerator } from './mutantGenerator.js'

export class MutationTestingService {
  protected readonly apexClassName: string
  protected readonly apexClassTestName: string

  constructor(
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

    const apexClass = await apexClassRepository.read(this.apexClassName)

    const mutantGenerator = new MutantGenerator()
    const mutations = mutantGenerator.compute(apexClass['Body'])
    const mutationResults: ApexMutationTestResult = {
      sourceFile: this.apexClassName,
      sourceFileContent: apexClass['Body'],
      testFile: this.apexClassTestName,
      mutants: [],
    }

    for (const mutation of mutations) {
      const mutatedVersion = mutantGenerator.mutate(mutation)

      try {
        await apexClassRepository.update({
          Id: apexClass['Id'] as string,
          Body: mutatedVersion,
        })

        const testResult: TestResult = await apexTestRunner.run(
          this.apexClassTestName
        )

        const mutantResult = this.buildMutantResult(mutation, testResult)

        mutationResults.mutants.push(mutantResult)
      } catch (_e) {
        // TODO Log
      }
    }

    try {
      await apexClassRepository.update({
        Id: apexClass['Id'] as string,
        Body: apexClass['Body'],
      })
    } catch (_e) {
      // TODO Log
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
