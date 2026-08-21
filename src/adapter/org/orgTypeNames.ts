import type { TypeName } from '../../port/apexSourceProvider.js'
import type { EntityDefinitionRow } from './entityDefinitionRepository.js'
import type { MetadataComponentDependency } from './MetadataComponentDependency.js'

// Same falsy test qualifiedApexClassName applies to an ApexClassIdentity's
// namespace, applied here to a dependency row's raw namespace field instead.
const hasNoNamespace = (namespace: string | null): boolean => !namespace

// The dotted Apex spelling (`ns.Name`) for a namespaced class, the bare name
// otherwise. `null` and `''` both mean "no namespace" — see hasNoNamespace.
export const qualifiedApexClassName = (
  name: string,
  namespace: string | null
): string => (hasNoNamespace(namespace) ? name : `${namespace}.${name}`)

export const identityTypeName = (name: string): TypeName => ({
  apiName: name,
  aliases: [name],
})

// Case-folded before comparing: Organization.NamespacePrefix,
// EntityDefinition.NamespacePrefix and
// MetadataComponentDependency.RefMetadataComponentNamespace are three
// distinct org-supplied values from three distinct sObjects, and nothing
// establishes that they agree on case. bareFieldAlias in
// orgSObjectSchemaProvider.ts already folds this same "is this namespace the
// org's own?" question for the third of the three; folding here keeps both
// uses in this file consistent with it instead of assuming, unstated, that
// org-canonical casing agrees across sources.
const foldedNamespace = (namespace: string | null): string | null =>
  // isOwnNamespace folds BOTH sides through this function, so the direction
  // of the fold cannot be observed — upper and lower agree on every input
  // pair. Only folding-versus-not is behavioural, and that is pinned. A
  // falsy check (not a null check) is what makes '' fold to the same null
  // as an absent namespace — required because
  // OrganizationRepository.readNamespacePrefix and an ApexClass row can
  // each report either spelling for "no namespace", and nothing upstream
  // guarantees they agree.
  // Stryker disable next-line MethodExpression: both sides fold in lockstep.
  namespace ? namespace.toLowerCase() : null

export const isOwnNamespace = (
  namespace: string | null,
  orgNamespace: string | null
): boolean => foldedNamespace(namespace) === foldedNamespace(orgNamespace)

// A local class is a legitimate source spelling as-is. A managed-package
// class uses the Apex dotted convention (`ns.Name`), unlike the `ns__Name`
// object convention. The bare name is only ever a legal spelling for a class
// in the org's OWN namespace — source in namespace A can write its own
// `Mutation` bare, but can never write a foreign package B's class without
// the `B.` qualifier — so the bare alias is minted only when the row's
// namespace matches the org's.
export const toApexClassTypeName = (
  dep: MetadataComponentDependency,
  orgNamespace: string | null
): TypeName => {
  const name = dep.RefMetadataComponentName
  const namespace = dep.RefMetadataComponentNamespace
  if (hasNoNamespace(namespace)) {
    return identityTypeName(name)
  }
  const apiName = qualifiedApexClassName(name, namespace)
  const aliases = isOwnNamespace(namespace, orgNamespace)
    ? [apiName, name]
    : [apiName]
  return { apiName, aliases }
}

// Derives the bare object alias (`ProbeObj__c`) from the org-true qualified
// name (`namespaced__ProbeObj__c`) and its namespace — but only when that
// namespace is the org's OWN: a bare spelling is legal source only inside
// the namespace that owns it, so a foreign package's object must never mint
// one (minting it unconditionally is what let a foreign and a local object
// sharing a developer name collide on the same bare alias). Rather than
// blindly slicing a prefix off a name that does not carry it — which would
// emit a mangled alias — this returns nothing when the qualified name does
// not start with the row's own namespace either.
//
// No separate null/empty guard on namespacePrefix: isOwnNamespace already
// answers false for a null/'' row against a real orgNamespace. The one case
// it does not filter — a null/'' row against a null/'' (non-namespaced) org —
// still resolves to `undefined` below, because the resulting prefix
// (`${null}__` = "null__", `${''}__` = "__") is not a prefix any real
// qualified api name carries.
const bareObjectAlias = (
  qualifiedApiName: string,
  namespacePrefix: string | null,
  orgNamespace: string | null
): string | undefined => {
  if (!isOwnNamespace(namespacePrefix, orgNamespace)) {
    return undefined
  }
  const prefix = `${namespacePrefix}__`
  return qualifiedApiName.startsWith(prefix)
    ? qualifiedApiName.slice(prefix.length)
    : undefined
}

// The developer name is deliberately never an alias for a CustomObject:
// source can never write `ProbeObj` for a type whose api name is
// `ProbeObj__c`, so aliasing it would only create false matches against an
// unrelated Apex class of that name.
const toCustomObjectTypeName = (
  row: EntityDefinitionRow,
  orgNamespace: string | null
): TypeName => {
  const bareAlias = bareObjectAlias(
    row.QualifiedApiName,
    row.NamespacePrefix,
    orgNamespace
  )
  const aliases =
    bareAlias === undefined
      ? [row.QualifiedApiName]
      : [row.QualifiedApiName, bareAlias]
  return {
    apiName: row.QualifiedApiName,
    aliases,
  }
}

// Both sides are org-canonical developer names for the same object, not
// case-folded (unlike assessPerimeter's fold, which exists because
// user-supplied class names reach it there). The join is exact only when the
// key is unique: DeveloperName strips the suffix, so Foo__c, Foo__e, Foo__b,
// Foo__x and Foo__mdt can all share one key in one namespace — see
// groupByJoinKey, which is where a shared key is caught.
const entityJoinKey = (name: string, namespace: string | null): string =>
  // The separator and the null-namespace stand-in are internal to this key
  // and never cross a boundary: both the map keys and the lookups are built
  // by this one function, so any distinct pair of literals partitions the
  // rows identically.
  // Stryker disable next-line StringLiteral: an internal-only key literal.
  `${name}::${namespace ?? ''}`

// Groups rather than indexing 1:1, so a key shared by more than one row is
// visible to the caller instead of the last row silently winning.
export const groupByJoinKey = (
  rows: EntityDefinitionRow[]
): Map<string, EntityDefinitionRow[]> => {
  const grouped = new Map<string, EntityDefinitionRow[]>()
  for (const row of rows) {
    const key = entityJoinKey(row.DeveloperName, row.NamespacePrefix)
    const bucket = grouped.get(key)
    if (bucket) {
      bucket.push(row)
    } else {
      grouped.set(key, [row])
    }
  }
  return grouped
}

// Renders the spelling closest to what the user's source could have written:
// the org's `ns__Name__c` object convention minus the suffix, which is
// exactly what failed to resolve and so cannot be known. The bare developer
// name alone would render two unresolved same-named objects in different
// namespaces identically.
export const qualifiedDeveloperName = (
  name: string,
  namespace: string | null
): string => (namespace ? `${namespace}__${name}` : name)

export interface EntityRowPartition {
  resolved: TypeName[]
  unresolvedNames: Set<string>
}

// Exactly one candidate resolves; zero or more than one (an ambiguous key)
// is unresolved, never a guess at which row is right.
export const partitionByEntityRow = (
  rows: MetadataComponentDependency[],
  rowsByJoinKey: Map<string, EntityDefinitionRow[]>,
  orgNamespace: string | null
): EntityRowPartition => {
  const resolved: TypeName[] = []
  const unresolvedNames = new Set<string>()
  for (const row of rows) {
    const { RefMetadataComponentName: name } = row
    const namespace = row.RefMetadataComponentNamespace
    const candidates = rowsByJoinKey.get(entityJoinKey(name, namespace))
    if (candidates?.length === 1) {
      resolved.push(toCustomObjectTypeName(candidates[0], orgNamespace))
    } else {
      unresolvedNames.add(qualifiedDeveloperName(name, namespace))
    }
  }
  return { resolved, unresolvedNames }
}
