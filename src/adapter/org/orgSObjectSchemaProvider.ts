import { Connection } from '@salesforce/core'
import { mapLimit } from 'async'
import type { EngineNotify } from '../../port/executionEngine.js'
import type { SObjectSchemaProvider } from '../../port/sObjectSchemaProvider.js'
import type { ApexType } from '../../type/ApexMethod.js'
import { APEX_TYPE, SObjectFieldTypes } from '../../type/ApexMethod.js'

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

// Salesforce forbids `__` inside a custom field developer name, so a folded
// name splitting into exactly three `__`-separated segments unambiguously
// means namespaced (standard fields split into one segment, non-namespaced
// custom fields into two). `namespaced__Amount__c` -> `amount__c`;
// `Amount__c` and `Name` -> undefined.
const NAMESPACED_FIELD_SEGMENT_COUNT = 3

const bareFieldAlias = (foldedFieldName: string): string | undefined => {
  const segments = foldedFieldName.split('__')
  return segments.length === NAMESPACED_FIELD_SEGMENT_COUNT
    ? `${segments[1]}__${segments[2]}`
    : undefined
}

type DescribedField = { name: string; type: string }
type NormalizedField = { foldedName: string; type: ApexType }

const normalizeFields = (fields: DescribedField[]): NormalizedField[] =>
  fields.map(field => ({
    foldedName: field.name.toLowerCase(),
    type: DESCRIBE_FIELD_TYPE_MAP[field.type] ?? APEX_TYPE.OBJECT,
  }))

// Two passes: every real field first, then a namespace-bare alias for each
// namespaced field, added only for a key not already claimed by a real
// field. A subscriber can add a local `Amount__c` to an installed
// `pkg__Obj__c` that already has `pkg__Amount__c` — a real field must never
// lose to a derived alias.
const buildFieldMap = (fields: DescribedField[]): Map<string, ApexType> => {
  const normalized = normalizeFields(fields)
  const fieldMap = new Map<string, ApexType>()
  for (const { foldedName, type } of normalized) {
    fieldMap.set(foldedName, type)
  }
  for (const { foldedName, type } of normalized) {
    const alias = bareFieldAlias(foldedName)
    if (alias !== undefined && !fieldMap.has(alias)) {
      fieldMap.set(alias, type)
    }
  }
  return fieldMap
}

type DescribeFailure = { name: string; error: Error }

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value))

export class OrgSObjectSchemaProvider implements SObjectSchemaProvider {
  private readonly fieldTypes: SObjectFieldTypes = new Map()

  constructor(
    private readonly connection: Connection,
    private readonly notify: EngineNotify
  ) {}

  public async describe(sObjectNames: string[]): Promise<void> {
    const failures: DescribeFailure[] = []
    await mapLimit(
      sObjectNames,
      MAX_CONCURRENT_DESCRIBE_CALLS,
      async (name: string) => {
        try {
          const describeResult = await this.connection.describe(name)
          this.fieldTypes.set(
            name.toLowerCase(),
            buildFieldMap(describeResult.fields)
          )
        } catch (error) {
          failures.push({ name, error: toError(error) })
        }
      }
    )
    this.reportFailures(failures)
  }

  public resolveFieldType(
    sObjectTypeName: string,
    fieldPath: string
  ): ApexType | undefined {
    return this.fieldTypes
      .get(sObjectTypeName.toLowerCase())
      ?.get(fieldPath.toLowerCase())
  }

  // A single inaccessible sObject must not abort a run that works today, so
  // every failed describe is announced through one aggregated notice instead
  // of being fatal — or, as before, silently discarded.
  private reportFailures(failures: DescribeFailure[]): void {
    if (failures.length === 0) {
      return
    }
    this.notify({
      kind: 'type-resolution-degraded',
      typeNames: failures.map(failure => failure.name),
      error: failures[0].error,
    })
  }
}
