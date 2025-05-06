import { ApexMethod } from '../type/ApexMethod.js'
import { BaseListener } from './baseListener.js'

export class TypeAwareBaseListener extends BaseListener {
  protected typeTable: Map<string, ApexMethod> = new Map()

  setTypeTable(typeTable: Map<string, ApexMethod>): void {
    this.typeTable = typeTable
  }
}
