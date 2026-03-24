import { APEX_TYPE, ApexType } from '../type/ApexMethod.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseReturnMutator } from './baseReturnMutator.js'

export class FalseReturnMutator extends BaseReturnMutator {
  constructor(typeRegistry?: TypeRegistry) {
    super('false', typeRegistry)
  }

  protected isEligibleReturnType(apexType: ApexType): boolean {
    return apexType === APEX_TYPE.BOOLEAN
  }
}
