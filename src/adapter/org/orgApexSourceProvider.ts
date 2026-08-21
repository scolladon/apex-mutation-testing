import type {
  ApexSourceProvider,
  ApexTestSuiteMember,
  PerimeterAssessment,
  TargetClassVerdict,
  TypeDependencies,
  TypeName,
} from '../../port/apexSourceProvider.js'
import type { EngineNotify } from '../../port/executionEngine.js'
import type { ApexClass } from '../../type/ApexClass.js'
import type { ApexClassRef } from '../../type/ApexClassName.js'
import { splitApexClassName } from '../../type/ApexClassName.js'
import type { TestClassResolution } from '../../type/TestClassResolution.js'
import type { ApexClassIdentity } from './ApexClassIdentity.js'
import type {
  ApexClassCandidate,
  TargetClassSelection,
} from './apexClassMutability.js'
import {
  isMutableApexClass,
  selectMutableClass,
} from './apexClassMutability.js'
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
  isOwnNamespace,
  partitionByEntityRow,
  qualifiedApexClassName,
  qualifiedDeveloperName,
  toApexClassTypeName,
} from './orgTypeNames.js'

// Absent is a verdict, not an exception: the local `aer` backend may not
// populate ManageableState at all, and the message must say so readably
// rather than printing `null`.
const NO_STATE_REPORTED = 'none reported'
const observedState = (state: string | null): string =>
  state ?? NO_STATE_REPORTED

// Every row's qualified spelling is always a lookup key. Its bare spelling
// joins only when the row is unambiguous as the source of that bare name
// within the returned set: either its namespace is the org's own, or no
// other row in the set answers to the same bare name — a bare name shared by
// two foreign rows resolves to neither, rather than to an arbitrary one of
// them. A row with no namespace has no separate qualified spelling to begin
// with (the bare name IS its only spelling), so the ambiguity question never
// arises for it. Case-folded throughout because ApexClass.Name matches
// case-insensitively on the org and the perimeter entry is user-typed.
const spellingsOf = (
  identity: ApexClassIdentity,
  orgNamespace: string | null,
  bareNameCounts: ReadonlyMap<string, number>
): string[] => {
  const bare = identity.Name.toLowerCase()
  const qualified = qualifiedApexClassName(
    identity.Name,
    identity.NamespacePrefix
  ).toLowerCase()
  if (bare === qualified) {
    return [bare]
  }
  const mintsBare =
    isOwnNamespace(identity.NamespacePrefix, orgNamespace) ||
    bareNameCounts.get(bare) === 1
  return mintsBare ? [bare, qualified] : [qualified]
}

// Case-folded so a bare name shared by two rows differing only in case is
// still recognised as contested.
const countBareNames = (
  identities: ApexClassIdentity[]
): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const identity of identities) {
    const bare = identity.Name.toLowerCase()
    counts.set(bare, (counts.get(bare) ?? 0) + 1)
  }
  return counts
}

// One resolution per row, but a row's lookupKeys now depend on the whole
// returned set, not on the row alone: a bare spelling shared by more than one
// row is ambiguous, so only the org's own row — or a row that is the bare
// name's sole claimant — answers to it.
const toResolutions = (
  identities: ApexClassIdentity[],
  orgNamespace: string | null
): TestClassResolution[] => {
  const bareNameCounts = countBareNames(identities)
  return identities.map(identity => ({
    classId: identity.Id,
    displayName: qualifiedApexClassName(
      identity.Name,
      identity.NamespacePrefix
    ),
    lookupKeys: spellingsOf(identity, orgNamespace, bareNameCounts),
  }))
}

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

  // The qualifier narrows the candidate set BEFORE the tie-break runs; it
  // never becomes a new verdict kind and never reaches a downstream join.
  private select<T extends ApexClassCandidate>(
    candidates: readonly T[],
    ref: ApexClassRef
  ): TargetClassSelection<T> {
    const scoped =
      ref.namespace === null
        ? candidates
        : candidates.filter(c =>
            isOwnNamespace(c.NamespacePrefix, ref.namespace)
          )
    return selectMutableClass(scoped, this.orgNamespace)
  }

  public async assessTargetClass(name: string): Promise<TargetClassVerdict> {
    const ref = splitApexClassName(name)
    const selection = this.select(
      await this.repository.readCandidates(ref.name),
      ref
    )
    switch (selection.kind) {
      case 'mutable':
        return { kind: 'mutable' }
      case 'not-mutable':
        return {
          kind: 'not-mutable',
          states: selection.candidates.map(c =>
            observedState(c.ManageableState)
          ),
        }
      case 'ambiguous':
        return {
          kind: 'ambiguous',
          spellings: selection.candidates.map(c =>
            qualifiedApexClassName(ref.name, c.NamespacePrefix)
          ),
        }
      case 'not-found':
        return { kind: 'not-found' }
    }
  }

  public async readClass(name: string): Promise<ApexClass> {
    const ref = splitApexClassName(name)
    const selection = this.select(
      await this.repository.readBodyCandidates(ref.name),
      ref
    )
    if (selection.kind !== 'mutable') {
      throw new Error(
        `Apex class '${name}' cannot be read for mutation (${selection.kind})`
      )
    }
    return selection.candidate
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
   *  and any *mutable* row makes the entry usable — a qualified entry can
   *  match at most one row, so "is at least one row for this entry usable"
   *  reduces to "is *the* row usable". Every join is case-folded —
   *  `ApexClass.Name` matches case-insensitively on the org — while the
   *  reported className keeps the perimeter entry's own spelling. The same
   *  query also yields every resolution: one per row the query returned,
   *  not one per perimeter entry — a bare entry matching two rows
   *  contributes two, so whichever class the org actually runs is present
   *  under its own Id. */
  public async assessPerimeter(
    apexTestClassNames: string[]
  ): Promise<PerimeterAssessment> {
    const identities = await this.repository.readIdentities(apexTestClassNames)
    const resolutions = toResolutions(identities, this.orgNamespace)
    const rows = identities.map((identity, index) => ({
      identity,
      resolution: resolutions[index],
    }))
    const known = new Set(
      rows.flatMap(({ resolution }) => resolution.lookupKeys)
    )
    const accessible = new Set(
      rows
        .filter(({ identity }) => isMutableApexClass(identity))
        .flatMap(({ resolution }) => resolution.lookupKeys)
    )
    const skipped = apexTestClassNames
      .filter(name => !accessible.has(name.toLowerCase()))
      .map(name => ({
        className: name, // the caller's own spelling — load-bearing, see below
        reason: known.has(name.toLowerCase())
          ? ('not-accessible' as const)
          : ('not-found' as const),
      }))
    return { skipped, resolutions }
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
