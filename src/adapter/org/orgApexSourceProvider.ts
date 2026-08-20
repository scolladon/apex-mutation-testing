import type {
  ApexSourceProvider,
  ApexTestSuiteMember,
  TypeDependencies,
  TypeName,
} from '../../port/apexSourceProvider.js'
import type { EngineNotify } from '../../port/executionEngine.js'
import type { ApexClass } from '../../type/ApexClass.js'
import type { SkippedTestClass } from '../../type/SkippedTestClass.js'
import type { ApexClassIdentity } from './ApexClassIdentity.js'
import type { ApexClassRepository } from './apexClassRepository.js'
import type { ApexTestSuiteRepository } from './apexTestSuiteRepository.js'
import type {
  EntityDefinitionRepository,
  EntityDefinitionRow,
} from './entityDefinitionRepository.js'
import type { MetadataComponentDependency } from './MetadataComponentDependency.js'

// A namespace prefix of `null` or `''` both mean local: the org emits either
// depending on projection, so both must read as usable.
const isLocal = (identity: ApexClassIdentity): boolean =>
  !identity.NamespacePrefix

// Same falsy test as isLocal above, applied to a dependency row's raw
// namespace field instead of an ApexClassIdentity.
const hasNoNamespace = (namespace: string | null): boolean => !namespace

const identityTypeName = (name: string): TypeName => ({
  apiName: name,
  aliases: [name],
})

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value))

// A local class is a legitimate source spelling as-is. A managed-package
// class uses the Apex dotted convention (`ns.Name`), unlike the `ns__Name`
// object convention, and the bare name remains a valid spelling too.
const toApexClassTypeName = (dep: MetadataComponentDependency): TypeName => {
  const name = dep.RefMetadataComponentName
  if (hasNoNamespace(dep.RefMetadataComponentNamespace)) {
    return identityTypeName(name)
  }
  const apiName = `${dep.RefMetadataComponentNamespace}.${name}`
  return { apiName, aliases: [apiName, name] }
}

// Derives the bare object alias (`ProbeObj__c`) from the org-true qualified
// name (`namespaced__ProbeObj__c`) and its namespace. Rather than blindly
// slicing a prefix off a name that does not carry it — which would emit a
// mangled alias — this returns nothing when the qualified name does not
// start with the row's own namespace.
const bareObjectAlias = (
  qualifiedApiName: string,
  namespacePrefix: string | null
): string | undefined => {
  if (!namespacePrefix) {
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
const toCustomObjectTypeName = (row: EntityDefinitionRow): TypeName => {
  const bareAlias = bareObjectAlias(row.QualifiedApiName, row.NamespacePrefix)
  const aliases =
    bareAlias === undefined
      ? [row.QualifiedApiName]
      : [row.QualifiedApiName, bareAlias]
  return {
    apiName: row.QualifiedApiName,
    aliases,
    namespace: row.NamespacePrefix,
  }
}

// Both sides are org-canonical developer names for the same object, not
// case-folded (unlike assessPerimeter's fold, which exists because
// user-supplied class names reach it there). The join is exact only when the
// key is unique: DeveloperName strips the suffix, so Foo__c, Foo__e, Foo__b,
// Foo__x and Foo__mdt can all share one key in one namespace — see
// groupByJoinKey, which is where a shared key is caught.
const entityJoinKey = (name: string, namespace: string | null): string =>
  `${name}::${namespace ?? ''}`

// Groups rather than indexing 1:1, so a key shared by more than one row is
// visible to the caller instead of the last row silently winning.
const groupByJoinKey = (
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
const qualifiedDeveloperName = (
  name: string,
  namespace: string | null
): string => (namespace ? `${namespace}__${name}` : name)

export class OrgApexSourceProvider implements ApexSourceProvider {
  constructor(
    private readonly repository: ApexClassRepository,
    private readonly suiteRepository: ApexTestSuiteRepository,
    private readonly entityDefinitionRepository: EntityDefinitionRepository,
    private readonly notify: EngineNotify
  ) {}

  // Existence-only check: a minimal projection avoids the `*` field list
  // jsforce resolves for an unprojected find (a describe$ round-trip
  // pulling every ApexClass field, including Body and SymbolTable).
  // readClass re-reads the same class in full when mutation actually
  // starts, so that full read is deliberately left alone.
  public async classExists(name: string): Promise<boolean> {
    return Boolean(await this.repository.read(name, ['Id']))
  }

  public async readClass(name: string): Promise<ApexClass> {
    return (await this.repository.read(name)) as unknown as ApexClass
  }

  public async listDependencies(
    apexClass: ApexClass
  ): Promise<TypeDependencies> {
    const dependencies = await this.repository.getApexClassDependencies(
      apexClass.Id
    )

    const apexClasses = dependencies
      .filter(dep => dep.RefMetadataComponentType === 'ApexClass')
      .map(toApexClassTypeName)

    const standardEntityTypes = dependencies
      .filter(dep => dep.RefMetadataComponentType === 'StandardEntity')
      .map(dep => identityTypeName(dep.RefMetadataComponentName))

    const customObjectRows = dependencies.filter(
      dep => dep.RefMetadataComponentType === 'CustomObject'
    )
    const customObjectTypes = await this.resolveCustomObjects(customObjectRows)

    return {
      apexClasses,
      sObjects: [...standardEntityTypes, ...customObjectTypes],
    }
  }

  // A dependency set with no custom object must cost no extra org
  // round-trip: the early return here is a guard distinct from the
  // empty-`$in` guard inside the repository, which protects a different
  // failure mode (an unfiltered query rather than an unneeded one).
  private async resolveCustomObjects(
    rows: MetadataComponentDependency[]
  ): Promise<TypeName[]> {
    if (rows.length === 0) {
      return []
    }

    const entityRows = await this.readEntityRows(rows)
    if (entityRows === undefined) {
      return []
    }
    const rowsByJoinKey = groupByJoinKey(entityRows)

    const resolved: TypeName[] = []
    const unresolvedNames = new Set<string>()
    for (const row of rows) {
      const candidates = rowsByJoinKey.get(
        entityJoinKey(
          row.RefMetadataComponentName,
          row.RefMetadataComponentNamespace
        )
      )
      // Exactly one candidate resolves; zero or more than one (an ambiguous
      // key) is unresolved, never a guess at which row is right.
      if (candidates?.length === 1) {
        resolved.push(toCustomObjectTypeName(candidates[0]))
      } else {
        unresolvedNames.add(
          qualifiedDeveloperName(
            row.RefMetadataComponentName,
            row.RefMetadataComponentNamespace
          )
        )
      }
    }

    if (unresolvedNames.size > 0) {
      this.notify({
        kind: 'type-resolution-degraded',
        typeNames: [...unresolvedNames],
      })
    }
    return resolved
  }

  // A failed read must degrade, never abort: on `main` this path was a local
  // map that could not fail, but it now crosses the Tooling API and can
  // reject on permissions, transient network, or the `EXCEEDED_ID_LIMIT`
  // EntityDefinition is known to throw. Every requested row is reported
  // unresolved through the same notice the no-row case uses, rather than
  // letting the rejection propagate through listDependencies -> discoverTypes
  // -> process() and kill the whole run.
  private async readEntityRows(
    rows: MetadataComponentDependency[]
  ): Promise<EntityDefinitionRow[] | undefined> {
    // Deduped: the join key is name+namespace precisely because one name can
    // appear under two namespaces, so a duplicate name here is a redundant
    // SOQL term the downstream join tolerates without a 1:1 row-to-request
    // correspondence.
    const names = [...new Set(rows.map(row => row.RefMetadataComponentName))]
    try {
      return await this.entityDefinitionRepository.readByDeveloperNames(names)
    } catch (error) {
      const failedNames = new Set(
        rows.map(row =>
          qualifiedDeveloperName(
            row.RefMetadataComponentName,
            row.RefMetadataComponentNamespace
          )
        )
      )
      this.notify({
        kind: 'type-resolution-degraded',
        typeNames: [...failedNames],
        error: toError(error),
      })
      return undefined
    }
  }

  /** A name can return two rows when a managed and a local class share it,
   *  and any local row makes the entry usable. Every join is case-folded —
   *  `ApexClass.Name` matches case-insensitively on the org — while the
   *  reported className keeps the perimeter entry's own spelling. */
  public async assessPerimeter(
    apexTestClassNames: string[]
  ): Promise<SkippedTestClass[]> {
    const identities = await this.repository.readIdentities(apexTestClassNames)
    const lowerNames = (rows: ApexClassIdentity[]) =>
      new Set(rows.map(identity => identity.Name.toLowerCase()))
    const known = lowerNames(identities)
    const accessible = lowerNames(identities.filter(isLocal))
    return apexTestClassNames
      .filter(name => !accessible.has(name.toLowerCase()))
      .map(name => ({
        className: name,
        reason: known.has(name.toLowerCase())
          ? ('not-accessible' as const)
          : ('not-found' as const),
      }))
  }

  public async readTestSuiteMembers(
    suiteNames: string[]
  ): Promise<ApexTestSuiteMember[]> {
    return this.suiteRepository.readMembers(suiteNames)
  }

  public async readExistingTestSuiteNames(
    suiteNames: string[]
  ): Promise<string[]> {
    return this.suiteRepository.readExistingSuiteNames(suiteNames)
  }
}
