import {
  ApexClassAmbiguousError,
  ApexClassNotFoundError,
  ApexClassNotMutableError,
  ApexClassUnqualifiedError,
} from '../port/apexClassErrors.js'
import type {
  ApexSourceProvider,
  PerimeterAssessment,
  TargetClassVerdict,
} from '../port/apexSourceProvider.js'
import { ApexMutationParameter } from '../type/ApexMutationParameter.js'

export class ApexClassValidator {
  constructor(private readonly source: ApexSourceProvider) {}

  // A non-void return restores TS2366 exhaustiveness checking on the switch
  // below: validate() itself returns Promise<void>, under which TypeScript
  // does not flag a missing case — silently permitting the run to proceed
  // and write to the org, the one dangerous default this dispatch must never
  // fall into. Returning the rejection (rather than throwing from inside the
  // switch) keeps that guarantee live.
  private static toRejection(
    verdict: TargetClassVerdict,
    className: string
  ): Error | null {
    switch (verdict.kind) {
      case 'mutable':
        return null
      case 'not-found':
        return new ApexClassNotFoundError(className)
      case 'not-mutable':
        return new ApexClassNotMutableError(className, verdict.states)
      case 'ambiguous':
        return new ApexClassAmbiguousError(className, verdict.spellings)
      case 'unqualified':
        return new ApexClassUnqualifiedError(className, verdict.spelling)
    }
  }

  public async validate({
    apexClassName,
  }: ApexMutationParameter): Promise<void> {
    const verdict = await this.source.assessTargetClass(apexClassName)
    const rejection = ApexClassValidator.toRejection(verdict, apexClassName)
    if (rejection) {
      throw rejection
    }
  }

  public async assessPerimeter(names: string[]): Promise<PerimeterAssessment> {
    return this.source.assessPerimeter(names)
  }
}
