import { Connection } from '@salesforce/core'
import { mapLimit } from 'async'
import { ApexType, SObjectFieldTypes } from '../type/ApexMethod.js'

const DESCRIBE_FIELD_TYPE_MAP: Record<string, ApexType> = {
  int: ApexType.INTEGER,
  double: ApexType.DOUBLE,
  currency: ApexType.DECIMAL,
  percent: ApexType.DOUBLE,
  date: ApexType.DATE,
  datetime: ApexType.DATETIME,
  boolean: ApexType.BOOLEAN,
  id: ApexType.ID,
  reference: ApexType.ID,
  string: ApexType.STRING,
  textarea: ApexType.STRING,
  email: ApexType.STRING,
  phone: ApexType.STRING,
  url: ApexType.STRING,
  picklist: ApexType.STRING,
  multipicklist: ApexType.STRING,
  encryptedstring: ApexType.STRING,
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
              DESCRIBE_FIELD_TYPE_MAP[field.type] ?? ApexType.OBJECT
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
