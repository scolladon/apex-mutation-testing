import { Connection } from '@salesforce/core'
import { ApexClassRepository } from '../adapter/apexClassRepository.js'
import { ApexClass } from '../type/ApexClass.js'
import { ApexMutationParameter } from '../type/ApexMutationParameter.js'

export class ApexClassValidator {
  private readonly apexClassRepository: ApexClassRepository
  constructor(protected readonly connection: Connection) {
    this.apexClassRepository = new ApexClassRepository(this.connection)
  }

  private async validateApexClass(apexClassName: string) {
    const errors: string[] = []
    const apexClass = await this.apexClassRepository.read(apexClassName)
    if (!apexClass) {
      errors.push(`Apex class ${apexClassName} not found`)
    }
    return errors
  }

  private async validateApexTestClass(apexTestClassName: string) {
    const errors: string[] = []
    const apexTestClass: ApexClass = (await this.apexClassRepository.read(
      apexTestClassName
    )) as unknown as ApexClass
    if (!apexTestClass) {
      errors.push(`Apex test class ${apexTestClassName} not found`)
    } else if (!apexTestClass.Body.toLowerCase().includes('@istest')) {
      errors.push(
        `Apex test class ${apexTestClassName} is not annotated with @isTest`
      )
    }

    return errors
  }

  public async validate({
    apexClassName,
    apexTestClassName,
  }: ApexMutationParameter) {
    const errors: string[] = []
    errors.push(...(await this.validateApexClass(apexClassName)))
    errors.push(...(await this.validateApexTestClass(apexTestClassName)))
    if (errors.length > 0) {
      throw new Error(errors.join('\n'))
    }
  }
}
