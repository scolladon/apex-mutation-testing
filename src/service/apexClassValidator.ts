import type {
  ApexSourceProvider,
  PerimeterAssessment,
} from '../port/apexSourceProvider.js'
import { ApexMutationParameter } from '../type/ApexMutationParameter.js'

export class ApexClassNotFoundError extends Error {
  constructor(public readonly className: string) {
    super(`Apex class '${className}' not found`)
    this.name = 'ApexClassNotFoundError'
  }
}

export class ApexClassNotMutableError extends Error {
  constructor(
    public readonly className: string,
    public readonly states: string[]
  ) {
    super(`Apex class '${className}' is not modifiable on this org`)
    this.name = 'ApexClassNotMutableError'
  }
}

export class ApexClassAmbiguousError extends Error {
  constructor(
    public readonly className: string,
    public readonly spellings: string[]
  ) {
    super(`Apex class '${className}' matches more than one modifiable class`)
    this.name = 'ApexClassAmbiguousError'
  }
}

export class ApexClassValidator {
  constructor(private readonly source: ApexSourceProvider) {}

  public async validate({
    apexClassName,
  }: ApexMutationParameter): Promise<void> {
    const verdict = await this.source.assessTargetClass(apexClassName)
    switch (verdict.kind) {
      case 'mutable':
        return
      case 'not-found':
        throw new ApexClassNotFoundError(apexClassName)
      case 'not-mutable':
        throw new ApexClassNotMutableError(apexClassName, verdict.states)
      case 'ambiguous':
        throw new ApexClassAmbiguousError(apexClassName, verdict.spellings)
    }
  }

  public async assessPerimeter(names: string[]): Promise<PerimeterAssessment> {
    return this.source.assessPerimeter(names)
  }
}
