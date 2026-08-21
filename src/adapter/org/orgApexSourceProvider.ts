import type {
  ApexSourceProvider,
  ApexTestSuiteMember,
  PerimeterAssessment,
  TargetClassVerdict,
  TypeDependencies,
  TypeName,
} from '../../port/apexSourceProvider.js'
import type { EngineNotify } from '../../port/executionEngine.js'
import {
  ApexClassAmbiguousError,
  ApexClassNotFoundError,
  ApexClassNotMutableError,
  ApexClassUnqualifiedError,
} from '../../service/apexClassValidator.js'
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

// Deduped: several non-mutable rows commonly share one ManageableState (e.g.
// three managed rows all reporting 'installed'), and the message this feeds
// is phrased in the singular — without deduping, a repeated state would
// render as "manageable state: installed, installed, installed".
const observedStates = (
  candidates: readonly ApexClassCandidate[]
): string[] => [
  ...new Set(candidates.map(c => observedState(c.ManageableState))),
]

// Every row's qualified spelling is always a lookup key. Its bare spelling
// joins only when the row's namespace is this org's own — a bare name is
// legal source only inside the namespace that owns it, so a foreign row must
// never mint one, even when it is the only row that answers to that bare
// name: admitting it there is exactly the write-perimeter defect this rule
// closes (selectMutableClass's own-namespace arm enforces the identical rule
// on the write side). Case-folded throughout because ApexClass.Name matches
// case-insensitively on the org and the perimeter entry is user-typed.
const spellingsOf = (
  identity: ApexClassIdentity,
  orgNamespace: string | null
): string[] => {
  const bare = identity.Name.toLowerCase()
  const qualified = qualifiedApexClassName(
    identity.Name,
    identity.NamespacePrefix
  ).toLowerCase()
  if (bare === qualified) {
    // A row with no namespace has no separate qualified spelling to begin
    // with — the bare name IS its only spelling — so withholding it is not
    // an option: the row would be left with no lookup key at all.
    return [bare]
  }
  return isOwnNamespace(identity.NamespacePrefix, orgNamespace)
    ? [bare, qualified]
    : [qualified]
}

// One resolution per row.
const toResolutions = (
  identities: ApexClassIdentity[],
  orgNamespace: string | null
): TestClassResolution[] =>
  identities.map(identity => ({
    classId: identity.Id,
    displayName: qualifiedApexClassName(
      identity.Name,
      identity.NamespacePrefix
    ),
    lookupKeys: spellingsOf(identity, orgNamespace),
  }))

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
    // A qualifier names the namespace that owns this lookup; absent one, the
    // org's own does.
    return selectMutableClass(scoped, ref.namespace ?? this.orgNamespace)
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
          states: observedStates(selection.candidates),
        }
      case 'ambiguous':
        return {
          kind: 'ambiguous',
          spellings: selection.candidates.map(c =>
            qualifiedApexClassName(ref.name, c.NamespacePrefix)
          ),
        }
      case 'unqualified':
        return {
          kind: 'unqualified',
          spelling: qualifiedApexClassName(
            ref.name,
            selection.candidate.NamespacePrefix
          ),
        }
      case 'not-found':
        return { kind: 'not-found' }
    }
  }

  // Rejects with the same typed errors apexClassValidator.ts throws for the
  // identical conditions, rather than a raw Error naming its internal
  // verdict kind: assessTargetClass and readClass are two separate org
  // round-trips classifying the same rows, so a TOCTOU race between them
  // must surface through the one curated, already-handled error vocabulary.
  public async readClass(name: string): Promise<ApexClass> {
    const ref = splitApexClassName(name)
    const selection = this.select(
      await this.repository.readBodyCandidates(ref.name),
      ref
    )
    switch (selection.kind) {
      case 'mutable':
        return selection.candidate
      case 'not-found':
        throw new ApexClassNotFoundError(name)
      case 'not-mutable':
        throw new ApexClassNotMutableError(
          name,
          observedStates(selection.candidates)
        )
      case 'ambiguous':
        throw new ApexClassAmbiguousError(
          name,
          selection.candidates.map(c =>
            qualifiedApexClassName(ref.name, c.NamespacePrefix)
          )
        )
      case 'unqualified':
        throw new ApexClassUnqualifiedError(
          name,
          qualifiedApexClassName(ref.name, selection.candidate.NamespacePrefix)
        )
    }
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
    // Independent of lookupKeys on purpose: "does a class by this name exist
    // at all" and "does it answer to this exact spelling" are different
    // questions. Since spellingsOf withholds the bare key from a foreign row,
    // driving `known` off lookupKeys would make a bare entry naming only a
    // foreign row report not-found instead of not-accessible.
    const known = new Set(
      identities.flatMap(identity => [
        identity.Name.toLowerCase(),
        qualifiedApexClassName(
          identity.Name,
          identity.NamespacePrefix
        ).toLowerCase(),
      ])
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
