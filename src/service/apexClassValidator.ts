import { Connection } from '@salesforce/core'
import { ApexClassRepository } from '../adapter/apexClassRepository.js'
import { ApexClass } from '../type/ApexClass.js'
import { ApexMutationParameter } from '../type/ApexMutationParameter.js'
import { SkippedTestClass } from '../type/SkippedTestClass.js'

export class ApexClassNotFoundError extends Error {
  constructor(public readonly className: string) {
    super(className)
    this.name = 'ApexClassNotFoundError'
  }
}

export class ApexClassValidator {
  private readonly apexClassRepository: ApexClassRepository
  constructor(protected readonly connection: Connection) {
    this.apexClassRepository = new ApexClassRepository(this.connection)
  }

  public async validate({
    apexClassName,
  }: ApexMutationParameter): Promise<void> {
    const apexClass = await this.apexClassRepository.read(apexClassName)
    if (!apexClass) {
      throw new ApexClassNotFoundError(apexClassName)
    }
  }

  public async assessPerimeter(
    apexTestClassNames: string[]
  ): Promise<SkippedTestClass[]> {
    const verdicts = await Promise.all(
      apexTestClassNames.map(name => this.assessTestClass(name))
    )
    return verdicts.flat()
  }

  private async assessTestClass(
    apexTestClassName: string
  ): Promise<SkippedTestClass[]> {
    const apexTestClass: ApexClass = (await this.apexClassRepository.read(
      apexTestClassName
    )) as unknown as ApexClass
    if (!apexTestClass) {
      return [{ className: apexTestClassName, reason: 'not-readable' }]
    }
    if (!apexTestClass.Body.toLowerCase().includes('@istest')) {
      return [{ className: apexTestClassName, reason: 'not-a-test-class' }]
    }
    return []
  }
}
