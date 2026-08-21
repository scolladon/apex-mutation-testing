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

// Mirrors bareObjectAlias in orgApexSourceProvider.ts: strips a namespace
// prefix the caller already knows rather than inferring one from the field
// name's shape. Counting `__`-separated segments broke on geolocation
// compound fields, whose component names (`Loc__Latitude__s`) carry an extra
// `__` segment the developer name never had — that minted a bogus alias for
// a non-namespaced object and missed the real one for a namespaced object.
//
// Strips the ORG's own namespace, not the described object's: a bare field
// spelling is only legal source inside the namespace that owns the field, so
// an own-namespace field resolves bare wherever it lives — including on a
// standard object — while a foreign package's field on that same object
// mints nothing.
const bareFieldAlias = (
  foldedFieldName: string,
  orgNamespace: string | null
): string | undefined => {
  if (!orgNamespace) {
    return undefined
  }
  const prefix = `${orgNamespace.toLowerCase()}__`
  return foldedFieldName.startsWith(prefix)
    ? foldedFieldName.slice(prefix.length)
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
const buildFieldMap = (
  fields: DescribedField[],
  orgNamespace: string | null
): Map<string, ApexType> => {
  const normalized = normalizeFields(fields)
  const fieldMap = new Map<string, ApexType>()
  for (const { foldedName, type } of normalized) {
    fieldMap.set(foldedName, type)
  }
  for (const { foldedName, type } of normalized) {
    const alias = bareFieldAlias(foldedName, orgNamespace)
    if (alias !== undefined && !fieldMap.has(alias)) {
      fieldMap.set(alias, type)
    }
  }
  return fieldMap
}

type DescribeFailure = { name: string; error: Error }

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value))

// Groups by message rather than reporting the first error against every
// name, so a batch describe carrying two genuinely different failures
// reports each cause against only the names that actually hit it.
const groupByErrorMessage = (
  failures: DescribeFailure[]
): Map<string, DescribeFailure[]> => {
  const grouped = new Map<string, DescribeFailure[]>()
  for (const failure of failures) {
    const key = failure.error.message
    const bucket = grouped.get(key)
    if (bucket) {
      bucket.push(failure)
    } else {
      grouped.set(key, [failure])
    }
  }
  return grouped
}

export class OrgSObjectSchemaProvider implements SObjectSchemaProvider {
  private readonly fieldTypes: SObjectFieldTypes = new Map()

  constructor(
    private readonly connection: Connection,
    private readonly notify: EngineNotify,
    private readonly orgNamespace: string | null
  ) {}

  public async describe(apiNames: string[]): Promise<void> {
    const failures: DescribeFailure[] = []
    await mapLimit(
      apiNames,
      MAX_CONCURRENT_DESCRIBE_CALLS,
      async (apiName: string) => {
        try {
          const describeResult = await this.connection.describe(apiName)
          this.fieldTypes.set(
            apiName.toLowerCase(),
            buildFieldMap(describeResult.fields, this.orgNamespace)
          )
        } catch (error) {
          failures.push({ name: apiName, error: toError(error) })
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
  // every failed describe is announced through an aggregated notice instead
  // of being fatal — or, as before, silently discarded. One notice per
  // distinct cause, not one for all of them collapsed onto the first: naming
  // every failed sObject next to a reason only some of them share would make
  // causes 2..N untraceable.
  private reportFailures(failures: DescribeFailure[]): void {
    for (const causeFailures of groupByErrorMessage(failures).values()) {
      this.notify({
        kind: 'type-resolution-degraded',
        typeNames: causeFailures.map(failure => failure.name),
        error: causeFailures[0].error,
      })
    }
  }
}
