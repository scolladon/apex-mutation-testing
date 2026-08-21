import type {
  ApexSourceProvider,
  ApexTestSuiteMember,
  PerimeterAssessment,
  TypeDependencies,
  TypeName,
} from '../../port/apexSourceProvider.js'
import type { EngineNotify } from '../../port/executionEngine.js'
import type { ApexClass } from '../../type/ApexClass.js'
import type { TestClassResolution } from '../../type/TestClassResolution.js'
import type { ApexClassIdentity } from './ApexClassIdentity.js'
import type { ApexClassRepository } from './apexClassRepository.js'
import type { ApexTestSuiteRepository } from './apexTestSuiteRepository.js'
import type {
  EntityDefinitionRepository,
  EntityDefinitionRow,
} from './entityDefinitionRepository.js'
import type { MetadataComponentDependency } from './MetadataComponentDependency.js'
import {
  groupByJoinKey,
  identityTypeName,
  partitionByEntityRow,
  qualifiedApexClassName,
  qualifiedDeveloperName,
  toApexClassTypeName,
} from './orgTypeNames.js'

// A namespace prefix of `null` or `''` both mean local: the org emits either
// depending on projection, so both must read as usable.
const isLocal = (identity: ApexClassIdentity): boolean =>
  !identity.NamespacePrefix

// The two forms admitted as input, for one org row. Deliberately branchless:
// for a row with no namespace the qualified spelling IS the bare one, and the
// Set the caller builds collapses the duplicate. Case-folded because
// ApexClass.Name matches case-insensitively on the org and the perimeter entry
// is user-typed.
const spellingsOf = (identity: ApexClassIdentity): string[] => [
  identity.Name.toLowerCase(),
  qualifiedApexClassName(identity.Name, identity.NamespacePrefix).toLowerCase(),
]

// One row in, one resolution out. Not a resolution from a spelling: this is a
// 1:1 mapping from a row, so no candidate is ever picked over another.
const toResolution = (identity: ApexClassIdentity): TestClassResolution => ({
  classId: identity.Id,
  displayName: qualifiedApexClassName(identity.Name, identity.NamespacePrefix),
  lookupKeys: spellingsOf(identity),
})

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value))

export class OrgApexSourceProvider implements ApexSourceProvider {
  constructor(
    private readonly repository: ApexClassRepository,
    private readonly suiteRepository: ApexTestSuiteRepository,
    private readonly entityDefinitionRepository: EntityDefinitionRepository,
    private readonly notify: EngineNotify,
    private readonly orgNamespace: string | null
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
    return {
      apexClasses: this.resolveApexClasses(dependencies),
      sObjects: await this.resolveSObjects(dependencies),
    }
  }

  private resolveApexClasses(
    dependencies: MetadataComponentDependency[]
  ): TypeName[] {
    return dependencies
      .filter(dep => dep.RefMetadataComponentType === 'ApexClass')
      .map(dep => toApexClassTypeName(dep, this.orgNamespace))
  }

  private async resolveSObjects(
    dependencies: MetadataComponentDependency[]
  ): Promise<TypeName[]> {
    const standardEntityTypes = dependencies
      .filter(dep => dep.RefMetadataComponentType === 'StandardEntity')
      .map(dep => identityTypeName(dep.RefMetadataComponentName))

    const customObjectRows = dependencies.filter(
      dep => dep.RefMetadataComponentType === 'CustomObject'
    )
    const customObjectTypes = await this.resolveCustomObjects(customObjectRows)

    return [...standardEntityTypes, ...customObjectTypes]
  }

  // A dependency set with no custom object must cost no extra org
  // round-trip: this early return skips readEntityRows entirely, so the
  // repository's own empty-list handling (chunk([]) yields zero chunks,
  // pinned by queryChunking.test.ts) is never even reached from here.
  private async resolveCustomObjects(
    rows: MetadataComponentDependency[]
  ): Promise<TypeName[]> {
    if (rows.length === 0) {
      return []
    }

    const rowsByJoinKey = await this.indexEntityRows(rows)
    if (rowsByJoinKey === undefined) {
      return []
    }

    const { resolved, unresolvedNames } = partitionByEntityRow(
      rows,
      rowsByJoinKey,
      this.orgNamespace
    )
    if (unresolvedNames.size > 0) {
      this.notify({
        kind: 'type-resolution-degraded',
        typeNames: [...unresolvedNames],
      })
    }
    return resolved
  }

  private async indexEntityRows(
    rows: MetadataComponentDependency[]
  ): Promise<Map<string, EntityDefinitionRow[]> | undefined> {
    const entityRows = await this.readEntityRows(rows)
    return entityRows === undefined ? undefined : groupByJoinKey(entityRows)
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
      this.notifyEntityReadFailure(rows, error)
      return undefined
    }
  }

  private notifyEntityReadFailure(
    rows: MetadataComponentDependency[],
    error: unknown
  ): void {
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
  }

  /** A name can return two rows when a managed and a local class share it,
   *  and any local row makes the entry usable. Every join is case-folded —
   *  `ApexClass.Name` matches case-insensitively on the org — while the
   *  reported className keeps the perimeter entry's own spelling.
   *  Resolutions are emitted for every row the query returned, not one per
   *  perimeter entry — a bare entry matching two rows contributes two, so
   *  whichever class the org actually runs is present under its own Id. */
  public async assessPerimeter(
    apexTestClassNames: string[]
  ): Promise<PerimeterAssessment> {
    const identities = await this.repository.readIdentities(apexTestClassNames)
    const lowerNames = (rows: ApexClassIdentity[]) =>
      new Set(rows.map(identity => identity.Name.toLowerCase()))
    const known = lowerNames(identities)
    const accessible = lowerNames(identities.filter(isLocal))
    const skipped = apexTestClassNames
      .filter(name => !accessible.has(name.toLowerCase()))
      .map(name => ({
        className: name,
        reason: known.has(name.toLowerCase())
          ? ('not-accessible' as const)
          : ('not-found' as const),
      }))
    return { skipped, resolutions: identities.map(toResolution) }
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
