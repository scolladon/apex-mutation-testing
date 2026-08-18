import type { ApexType } from '../type/ApexMethod.js'

export interface SObjectSchemaProvider {
  describe(names: string[]): Promise<void>
  resolveFieldType(typeName: string, fieldPath: string): ApexType | undefined
}
