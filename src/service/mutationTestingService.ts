import { TestResult } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import { ApexClassRepository } from '../adapter/apexClassRepository.js'
import { ApexTestRunner } from '../adapter/apexTestRunner.js'
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
    let zombiesCount = 0
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
        if (testResult.summary.outcome === 'Pass') {
          // TODO warn we found a zombie
          ++zombiesCount
        }
      } catch (e) {
        // TODO Warn user this mutation failed and it is ignored
        console.log(e)
      }
    }
    try {
      await apexClassRepository.update({
        Id: apexClass['Id'] as string,
        Body: apexClass['Body'],
      })
    } catch (e) {
      // TODO Warn user it was not possible to revert the changes
      console.log(e)
    }

    // TODO Compute report

    return zombiesCount
  }
}
