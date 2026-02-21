import { Connection } from '@salesforce/core'
import { mapLimit } from 'async'
import type { ApexType } from '../type/ApexMethod.js'
import { APEX_TYPE, SObjectFieldTypes } from '../type/ApexMethod.js'

const DESCRIBE_FIELD_TYPE_MAP: Record<string, ApexType> = {
  int: APEX_TYPE.INTEGER,
  double: APEX_TYPE.DOUBLE,
  currency: APEX_TYPE.DECIMAL,
  percent: APEX_TYPE.DOUBLE,
  date: APEX_TYPE.DATE,
  datetime: APEX_TYPE.DATETIME,
  boolean: APEX_TYPE.BOOLEAN,
  id: APEX_TYPE.ID,
  reference: APEX_TYPE.ID,
  string: APEX_TYPE.STRING,
  textarea: APEX_TYPE.STRING,
  email: APEX_TYPE.STRING,
  phone: APEX_TYPE.STRING,
  url: APEX_TYPE.STRING,
  picklist: APEX_TYPE.STRING,
  multipicklist: APEX_TYPE.STRING,
  encryptedstring: APEX_TYPE.STRING,
}

const MAX_CONCURRENT_DESCRIBE_CALLS = 25

export class SObjectDescribeRepository {
  private readonly fieldTypes: SObjectFieldTypes = new Map()

  constructor(private readonly connection: Connection) {}

  public async describe(sObjectNames: string[]): Promise<void> {
    await mapLimit(
      sObjectNames,
      MAX_CONCURRENT_DESCRIBE_CALLS,
      async (name: string) => {
        try {
          const describeResult = await this.connection.describe(name)
          const fieldMap = new Map<string, ApexType>()
          for (const field of describeResult.fields) {
            fieldMap.set(
              field.name.toLowerCase(),
              DESCRIBE_FIELD_TYPE_MAP[field.type] ?? APEX_TYPE.OBJECT
            )
          }
          this.fieldTypes.set(name.toLowerCase(), fieldMap)
        } catch {
          // Skip sObjects that fail to describe (graceful degradation)
        }
      }
    )
  }

  public isSObject(typeName: string): boolean {
    return this.fieldTypes.has(typeName.toLowerCase())
  }

  public resolveFieldType(
    sObjectTypeName: string,
    fieldPath: string
  ): ApexType | undefined {
    return this.fieldTypes
      .get(sObjectTypeName.toLowerCase())
      ?.get(fieldPath.toLowerCase())
  }
}
