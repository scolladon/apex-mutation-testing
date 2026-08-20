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
  return { apiName: row.QualifiedApiName, aliases }
}

// Both sides are org-canonical developer names for the same object, so the
// join is exact, not case-folded (unlike assessPerimeter's fold, which
// exists because user-supplied class names reach it there).
const entityJoinKey = (name: string, namespace: string | null): string =>
  `${name}::${namespace ?? ''}`

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

    const entityRows =
      await this.entityDefinitionRepository.readByDeveloperNames(
        rows.map(row => row.RefMetadataComponentName)
      )
    const byJoinKey = new Map(
      entityRows.map(row => [
        entityJoinKey(row.DeveloperName, row.NamespacePrefix),
        row,
      ])
    )

    const resolved: TypeName[] = []
    const unresolvedNames: string[] = []
    for (const row of rows) {
      const entityRow = byJoinKey.get(
        entityJoinKey(
          row.RefMetadataComponentName,
          row.RefMetadataComponentNamespace
        )
      )
      if (entityRow) {
        resolved.push(toCustomObjectTypeName(entityRow))
      } else {
        unresolvedNames.push(row.RefMetadataComponentName)
      }
    }

    if (unresolvedNames.length > 0) {
      this.notify({
        kind: 'type-resolution-degraded',
        typeNames: unresolvedNames,
      })
    }
    return resolved
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
