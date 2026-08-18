import type { ApexSourceProvider } from '../port/apexSourceProvider.js'
import { ApexMutationParameter } from '../type/ApexMutationParameter.js'
import { SkippedTestClass } from '../type/SkippedTestClass.js'

export class ApexClassNotFoundError extends Error {
  constructor(public readonly className: string) {
    super(`Apex class '${className}' not found`)
    this.name = 'ApexClassNotFoundError'
  }
}

export class ApexClassValidator {
  constructor(private readonly source: ApexSourceProvider) {}

  public async validate({
    apexClassName,
  }: ApexMutationParameter): Promise<void> {
    if (!(await this.source.classExists(apexClassName))) {
      throw new ApexClassNotFoundError(apexClassName)
    }
  }

  public async assessPerimeter(names: string[]): Promise<SkippedTestClass[]> {
    return this.source.assessPerimeter(names)
  }
}
