import type { ApexType } from '../type/ApexMethod.js'

/** One sObject to describe, paired with the packaging namespace it is known
 *  to be installed under (`null` when local) — the value a schema provider
 *  needs to tell a describe()'d field's own namespace prefix from its bare
 *  spelling, rather than guessing one from the field name's shape. */
export interface DescribedSObject {
  apiName: string
  namespace: string | null
}

export interface SObjectSchemaProvider {
  describe(sObjects: DescribedSObject[]): Promise<void>
  resolveFieldType(typeName: string, fieldPath: string): ApexType | undefined
}
