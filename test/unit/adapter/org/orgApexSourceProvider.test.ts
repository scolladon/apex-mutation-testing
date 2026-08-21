import type { ApexClassRepository } from '../../../../src/adapter/org/apexClassRepository.js'
import type { ApexTestSuiteRepository } from '../../../../src/adapter/org/apexTestSuiteRepository.js'
import type { EntityDefinitionRepository } from '../../../../src/adapter/org/entityDefinitionRepository.js'
import type { MetadataComponentDependency } from '../../../../src/adapter/org/MetadataComponentDependency.js'
import { OrgApexSourceProvider } from '../../../../src/adapter/org/orgApexSourceProvider.js'
import type { EngineNotify } from '../../../../src/port/executionEngine.js'
import {
  ApexClassAmbiguousError,
  ApexClassNotFoundError,
  ApexClassNotMutableError,
  ApexClassUnqualifiedError,
} from '../../../../src/service/apexClassValidator.js'
import type { ApexClass } from '../../../../src/type/ApexClass.js'

// The org's own namespace, pinned to a single value throughout this suite so
// a fixture's namespace either equals it (own) or does not (foreign) — the
// only two arms the bare-alias derivation cares about.
const ORG_NAMESPACE = 'namespaced'

describe('OrgApexSourceProvider', () => {
  let sut: OrgApexSourceProvider
  let readCandidatesMock: ReturnType<typeof vi.fn>
  let readBodyCandidatesMock: ReturnType<typeof vi.fn>
  let readIdentitiesMock: ReturnType<typeof vi.fn>
  let getApexClassDependenciesMock: ReturnType<typeof vi.fn>
  let readMembersMock: ReturnType<typeof vi.fn>
  let readExistingSuiteNamesMock: ReturnType<typeof vi.fn>
  let readByDeveloperNamesMock: ReturnType<typeof vi.fn>
  let notifyMock: EngineNotify

  beforeEach(() => {
    // Arrange
    readCandidatesMock = vi.fn()
    readBodyCandidatesMock = vi.fn()
    readIdentitiesMock = vi.fn()
    getApexClassDependenciesMock = vi.fn()
    readMembersMock = vi.fn()
    readExistingSuiteNamesMock = vi.fn()
    readByDeveloperNamesMock = vi.fn().mockResolvedValue([])
    notifyMock = vi.fn()

    const repository = {
      readCandidates: readCandidatesMock,
      readBodyCandidates: readBodyCandidatesMock,
      readIdentities: readIdentitiesMock,
      getApexClassDependencies: getApexClassDependenciesMock,
    } as unknown as ApexClassRepository
    const suiteRepository = {
      readMembers: readMembersMock,
      readExistingSuiteNames: readExistingSuiteNamesMock,
    } as unknown as ApexTestSuiteRepository
    const entityDefinitionRepository = {
      readByDeveloperNames: readByDeveloperNamesMock,
    } as unknown as EntityDefinitionRepository

    sut = new OrgApexSourceProvider(
      repository,
      suiteRepository,
      entityDefinitionRepository,
      notifyMock,
      ORG_NAMESPACE
    )
  })

  describe('assessTargetClass', () => {
    it('Given a mutable own-source candidate, When assessTargetClass, Then resolves mutable', async () => {
      // Arrange
      readCandidatesMock.mockResolvedValueOnce([
        { NamespacePrefix: 'namespaced', ManageableState: 'deprecated' },
      ])

      // Act
      const result = await sut.assessTargetClass('Mutation')

      // Assert
      expect(result).toEqual({ kind: 'mutable' })
    })

    it('Given no candidate rows, When assessTargetClass, Then resolves not-found', async () => {
      // Arrange
      readCandidatesMock.mockResolvedValueOnce([])

      // Act
      const result = await sut.assessTargetClass('Argument')

      // Assert
      expect(result).toEqual({ kind: 'not-found' })
    })

    it('Given two non-mutable candidates, one with no reported state, When assessTargetClass, Then resolves not-mutable carrying every observed state', async () => {
      // Arrange
      readCandidatesMock.mockResolvedValueOnce([
        { NamespacePrefix: 'devedapp', ManageableState: 'installed' },
        { NamespacePrefix: 'acme', ManageableState: null },
      ])

      // Act
      const result = await sut.assessTargetClass('Argument')

      // Assert
      expect(result).toEqual({
        kind: 'not-mutable',
        states: ['installed', 'none reported'],
      })
    })

    it('Given three non-mutable candidates all reporting the same state, When assessTargetClass, Then resolves not-mutable with the state deduped to a single entry', async () => {
      // Arrange
      readCandidatesMock.mockResolvedValueOnce([
        { NamespacePrefix: 'devedapp', ManageableState: 'installed' },
        { NamespacePrefix: 'acme', ManageableState: 'installed' },
        { NamespacePrefix: 'mockery', ManageableState: 'installed' },
      ])

      // Act
      const result = await sut.assessTargetClass('Argument')

      // Assert — one entry, not one per row
      expect(result).toEqual({
        kind: 'not-mutable',
        states: ['installed'],
      })
    })

    it('Given two mutable candidates in two foreign namespaces, When assessTargetClass, Then resolves ambiguous carrying both qualified spellings', async () => {
      // Arrange
      readCandidatesMock.mockResolvedValueOnce([
        { NamespacePrefix: 'mockery', ManageableState: 'installedEditable' },
        { NamespacePrefix: 'acme', ManageableState: 'installedEditable' },
      ])

      // Act
      const result = await sut.assessTargetClass('Argument')

      // Assert
      expect(result).toEqual({
        kind: 'ambiguous',
        spellings: ['mockery.Argument', 'acme.Argument'],
      })
    })

    it('Given a single own-namespace mutable candidate, When assessTargetClass, Then resolves mutable', async () => {
      // Arrange
      readCandidatesMock.mockResolvedValueOnce([
        { NamespacePrefix: 'namespaced', ManageableState: 'unmanaged' },
      ])

      // Act
      const result = await sut.assessTargetClass('Argument')

      // Assert
      expect(result).toEqual({ kind: 'mutable' })
    })

    it('Given a mutable own-namespace row and a not-mutable foreign row, When assessTargetClass is qualified with the foreign namespace, Then the qualifier excludes the own-namespace row and resolves not-mutable', async () => {
      // Arrange — the own-namespace row carries the org's OWN namespace
      // explicitly (rather than null), so the pairing with the bare-query
      // test below genuinely turns on the own-namespace check.
      readCandidatesMock.mockResolvedValueOnce([
        {
          NamespacePrefix: ORG_NAMESPACE,
          ManageableState: 'installedEditable',
        },
        { NamespacePrefix: 'mockery', ManageableState: 'installed' },
      ])

      // Act
      const result = await sut.assessTargetClass('mockery.Argument')

      // Assert
      expect(result).toEqual({ kind: 'not-mutable', states: ['installed'] })
      // Regression guard: querying by the full qualified spelling
      // ('mockery.Argument') would match zero org rows, since ApexClass.Name
      // never carries the namespace segment.
      expect(readCandidatesMock).toHaveBeenCalledWith('Argument')
    })

    it('Given the same rows queried bare, When assessTargetClass, Then the unique mutable own-namespace row resolves mutable', async () => {
      // Arrange
      readCandidatesMock.mockResolvedValueOnce([
        {
          NamespacePrefix: ORG_NAMESPACE,
          ManageableState: 'installedEditable',
        },
        { NamespacePrefix: 'mockery', ManageableState: 'installed' },
      ])

      // Act
      const result = await sut.assessTargetClass('Argument')

      // Assert
      expect(result).toEqual({ kind: 'mutable' })
    })

    it('Given a qualified request for a foreign namespace with no candidate, When assessTargetClass, Then resolves not-found rather than redirecting to a local class sharing the bare name', async () => {
      // Arrange
      readCandidatesMock.mockResolvedValueOnce([
        { NamespacePrefix: null, ManageableState: 'unmanaged' },
      ])

      // Act
      const result = await sut.assessTargetClass('mockery.Nope')

      // Assert
      expect(result).toEqual({ kind: 'not-found' })
      expect(readCandidatesMock).toHaveBeenCalledWith('Nope')
    })

    // The write-perimeter defect this pins closed: in a plain org with an
    // unlocked package installed, a bare `-c Argument` must not silently
    // resolve into that package just because it is the only mutable row.
    it('Given a single mutable candidate in a foreign namespace, When assessTargetClass is queried bare, Then resolves unqualified naming the qualified spelling', async () => {
      // Arrange
      readCandidatesMock.mockResolvedValueOnce([
        { NamespacePrefix: 'mockery', ManageableState: 'installedEditable' },
      ])

      // Act
      const result = await sut.assessTargetClass('Argument')

      // Assert
      expect(result).toEqual({
        kind: 'unqualified',
        spelling: 'mockery.Argument',
      })
    })

    it('Given the same single foreign mutable candidate, When assessTargetClass is queried already qualified with that namespace, Then resolves mutable through the own-namespace arm', async () => {
      // Arrange — the qualifier itself becomes the namespace the write
      // perimeter checks against, so the same row now matches the own arm.
      readCandidatesMock.mockResolvedValueOnce([
        { NamespacePrefix: 'mockery', ManageableState: 'installedEditable' },
      ])

      // Act
      const result = await sut.assessTargetClass('mockery.Argument')

      // Assert
      expect(result).toEqual({ kind: 'mutable' })
    })
  })

  describe('readClass', () => {
    it('Given a mutable candidate, When readClass, Then resolves the selected candidate', async () => {
      // Arrange
      const candidate = {
        Id: '01p000000TargetId',
        Body: 'class Mutation {}',
        NamespacePrefix: 'namespaced',
        ManageableState: 'deprecated',
      }
      readBodyCandidatesMock.mockResolvedValueOnce([candidate])

      // Act
      const result = await sut.readClass('Mutation')

      // Assert
      expect(result).toEqual(candidate)
    })

    it('Given a qualified name, When readClass, Then the repository is queried by the bare name only', async () => {
      // Arrange — the CRITICAL regression this guards: querying by the full
      // qualified spelling ('mockery.Argument') would match zero org rows,
      // since ApexClass.Name never carries the namespace segment.
      const candidate = {
        Id: '01p000000TargetId',
        Body: 'class Argument {}',
        NamespacePrefix: 'mockery',
        ManageableState: 'installedEditable',
      }
      readBodyCandidatesMock.mockResolvedValueOnce([candidate])

      // Act
      await sut.readClass('mockery.Argument')

      // Assert
      expect(readBodyCandidatesMock).toHaveBeenCalledWith('Argument')
    })

    it('Given no candidate rows, When readClass, Then rejects with ApexClassNotFoundError', async () => {
      // Arrange
      readBodyCandidatesMock.mockResolvedValue([])

      // Act
      const rejection = sut.readClass('Argument')

      // Assert — the same typed error apexClassValidator.ts throws for the
      // identical condition, not a raw Error naming the verdict kind
      await expect(rejection).rejects.toThrow(ApexClassNotFoundError)
      await expect(rejection).rejects.toThrow("Apex class 'Argument' not found")
    })

    it('Given only non-mutable candidates, When readClass, Then rejects with ApexClassNotMutableError carrying the deduped states', async () => {
      // Arrange — two rows share one ManageableState, pinning the same
      // dedup readClass shares with assessTargetClass
      readBodyCandidatesMock.mockResolvedValueOnce([
        {
          Id: '1',
          Body: '(hidden)',
          NamespacePrefix: 'devedapp',
          ManageableState: 'installed',
        },
        {
          Id: '2',
          Body: '(hidden)',
          NamespacePrefix: 'acme',
          ManageableState: 'installed',
        },
      ])

      // Act
      const rejection = sut.readClass('Argument')

      // Assert
      await expect(rejection).rejects.toThrow(ApexClassNotMutableError)
      await expect(rejection).rejects.toThrow(
        "Apex class 'Argument' is not modifiable on this org"
      )
      await expect(rejection).rejects.toMatchObject({ states: ['installed'] })
    })

    it('Given two competing mutable candidates in foreign namespaces, When readClass, Then rejects with ApexClassAmbiguousError carrying both qualified spellings', async () => {
      // Arrange
      readBodyCandidatesMock.mockResolvedValueOnce([
        {
          Id: '1',
          Body: 'class Argument {}',
          NamespacePrefix: 'mockery',
          ManageableState: 'installedEditable',
        },
        {
          Id: '2',
          Body: 'class Argument {}',
          NamespacePrefix: 'acme',
          ManageableState: 'installedEditable',
        },
      ])

      // Act
      const rejection = sut.readClass('Argument')

      // Assert
      await expect(rejection).rejects.toThrow(ApexClassAmbiguousError)
      await expect(rejection).rejects.toMatchObject({
        spellings: ['mockery.Argument', 'acme.Argument'],
      })
    })

    it('Given a single mutable candidate in a foreign namespace, When readClass is queried bare, Then rejects with ApexClassUnqualifiedError naming the qualified spelling', async () => {
      // Arrange
      readBodyCandidatesMock.mockResolvedValueOnce([
        {
          Id: '1',
          Body: 'class Argument {}',
          NamespacePrefix: 'mockery',
          ManageableState: 'installedEditable',
        },
      ])

      // Act
      const rejection = sut.readClass('Argument')

      // Assert
      await expect(rejection).rejects.toThrow(ApexClassUnqualifiedError)
      await expect(rejection).rejects.toMatchObject({
        spelling: 'mockery.Argument',
      })
    })
  })

  describe('listDependencies', () => {
    const apexClass = { Id: '123', Body: '' } as ApexClass

    it('Given a StandardEntity dependency, When listing dependencies, Then sObjects carries an identity-mapped TypeName and no EntityDefinition read is issued', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'StandardEntity',
          RefMetadataComponentName: 'Account',
          RefMetadataComponentNamespace: null,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([
        { apiName: 'Account', aliases: ['Account'] },
      ])
      expect(readByDeveloperNamesMock).not.toHaveBeenCalled()
    })

    it("Given a CustomObject dependency belonging to the org's own namespace, When listing dependencies, Then sObjects carries the qualified api name and the bare alias", async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'ProbeObj',
          RefMetadataComponentNamespace: ORG_NAMESPACE,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'ProbeObj',
          QualifiedApiName: 'namespaced__ProbeObj__c',
          NamespacePrefix: ORG_NAMESPACE,
        },
      ])

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([
        {
          apiName: 'namespaced__ProbeObj__c',
          aliases: ['namespaced__ProbeObj__c', 'ProbeObj__c'],
        },
      ])
      expect(readByDeveloperNamesMock).toHaveBeenCalledWith(['ProbeObj'])
    })

    // Organization.NamespacePrefix and EntityDefinition.NamespacePrefix are
    // two distinct org-supplied values; nothing guarantees they agree on
    // case, so the own-namespace comparison must not assume they do.
    it("Given an EntityDefinition row's namespace differs from the org's own namespace only in case, When listing dependencies, Then sObjects still carries the bare alias", async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'ProbeObj',
          RefMetadataComponentNamespace: ORG_NAMESPACE.toUpperCase(),
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'ProbeObj',
          QualifiedApiName: 'NAMESPACED__ProbeObj__c',
          NamespacePrefix: ORG_NAMESPACE.toUpperCase(),
        },
      ])

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([
        {
          apiName: 'NAMESPACED__ProbeObj__c',
          aliases: ['NAMESPACED__ProbeObj__c', 'ProbeObj__c'],
        },
      ])
    })

    // The defect this whole change closes: a bare spelling is only legal
    // source for the org's OWN namespace, so a foreign package's object must
    // never mint one — unconditional minting is what let an org object and a
    // package object sharing a developer name collide on the same bare
    // alias, with the winner decided by dependency-row order.
    it('Given a CustomObject dependency belonging to a foreign namespace, When listing dependencies, Then sObjects carries only the qualified api name with no bare alias', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'ProbeObj',
          RefMetadataComponentNamespace: 'devedapp',
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'ProbeObj',
          QualifiedApiName: 'devedapp__ProbeObj__c',
          NamespacePrefix: 'devedapp',
        },
      ])

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([
        {
          apiName: 'devedapp__ProbeObj__c',
          aliases: ['devedapp__ProbeObj__c'],
        },
      ])
    })

    // Diverges from the fixture above by resolving to a __mdt suffix with no
    // namespace: a __c-only fixture would coincide with a mutant that appends
    // `__c` instead of reading QualifiedApiName, and this also drives the
    // namespace-null arm of the bare-alias derivation (no second alias).
    it('Given an unnamespaced CustomObject dependency resolving to a custom metadata type, When listing dependencies, Then sObjects carries only the qualified api name with no bare alias', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Invoice',
          RefMetadataComponentNamespace: null,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'Invoice',
          QualifiedApiName: 'Invoice__mdt',
          NamespacePrefix: null,
        },
      ])

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([
        { apiName: 'Invoice__mdt', aliases: ['Invoice__mdt'] },
      ])
    })

    it("Given an EntityDefinition row belonging to the org's own namespace whose qualified name does not carry that namespace, When listing dependencies, Then no bare alias is derived", async () => {
      // Arrange — rather than blindly slicing a prefix off a name that does
      // not carry it (which would emit a mangled alias), the derivation
      // returns nothing. The org never produces this shape (it always embeds
      // the prefix in QualifiedApiName); this is a defensive fixture pinning
      // that the guard fails closed rather than mangling the alias.
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Other',
          RefMetadataComponentNamespace: ORG_NAMESPACE,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'Other',
          QualifiedApiName: 'Other__c',
          NamespacePrefix: ORG_NAMESPACE,
        },
      ])

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([
        { apiName: 'Other__c', aliases: ['Other__c'] },
      ])
    })

    it("Given two EntityDefinition rows sharing a developer name where only one belongs to the org's own namespace, When listing dependencies, Then each row picks its own match and only the own-namespace row carries a bare alias", async () => {
      // Arrange — this is the exact shape of the collision the fix removes:
      // an org object and a foreign package object sharing a developer name
      // must not both be reachable through the same bare alias.
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Thing',
          RefMetadataComponentNamespace: ORG_NAMESPACE,
        },
        {
          Id: 'dep2',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Thing',
          RefMetadataComponentNamespace: 'devedapp',
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'Thing',
          QualifiedApiName: 'namespaced__Thing__c',
          NamespacePrefix: ORG_NAMESPACE,
        },
        {
          DeveloperName: 'Thing',
          QualifiedApiName: 'devedapp__Thing__c',
          NamespacePrefix: 'devedapp',
        },
      ])

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([
        {
          apiName: 'namespaced__Thing__c',
          aliases: ['namespaced__Thing__c', 'Thing__c'],
        },
        {
          apiName: 'devedapp__Thing__c',
          aliases: ['devedapp__Thing__c'],
        },
      ])
    })

    it('Given two EntityDefinition rows sharing a developer name in the same namespace, When listing dependencies, Then the dependency referencing that name is dropped as ambiguous and notify carries its name', async () => {
      // Arrange — DeveloperName strips the suffix, so Foo__c and Foo__e both
      // report DeveloperName 'Foo' in the same namespace; nothing on the
      // dependency row can break the tie, so the name is treated as
      // unresolved rather than silently picking one of the two rows.
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Foo',
          RefMetadataComponentNamespace: null,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'Foo',
          QualifiedApiName: 'Foo__c',
          NamespacePrefix: null,
        },
        {
          DeveloperName: 'Foo',
          QualifiedApiName: 'Foo__e',
          NamespacePrefix: null,
        },
      ])

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([])
      expect(notifyMock).toHaveBeenCalledWith({
        kind: 'type-resolution-degraded',
        typeNames: ['Foo'],
      })
    })

    it('Given two CustomObject dependency rows referencing the same developer name and namespace, When listing dependencies, Then the entity read is issued with the name only once', async () => {
      // Arrange — the join key is name+namespace precisely because one name
      // can appear under two namespaces, so a duplicate name is structurally
      // reachable and must not force a redundant SOQL term.
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Dup',
          RefMetadataComponentNamespace: null,
        },
        {
          Id: 'dep2',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Dup',
          RefMetadataComponentNamespace: null,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'Dup',
          QualifiedApiName: 'Dup__c',
          NamespacePrefix: null,
        },
      ])

      // Act
      await sut.listDependencies(apexClass)

      // Assert
      expect(readByDeveloperNamesMock).toHaveBeenCalledWith(['Dup'])
    })

    it('Given an unresolved CustomObject dependency carrying a namespace, When listing dependencies, Then notify carries the namespace-qualified developer name', async () => {
      // Arrange — the user's source says `ns__Gone__c`, not the bare
      // developer name `Gone`; reporting the bare spelling would render two
      // unresolved same-named objects in different namespaces identically.
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Gone',
          RefMetadataComponentNamespace: 'ns',
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([])

      // Act
      await sut.listDependencies(apexClass)

      // Assert
      expect(notifyMock).toHaveBeenCalledWith({
        kind: 'type-resolution-degraded',
        typeNames: ['ns__Gone'],
      })
    })

    it('Given two CustomObject dependency rows unresolved under the same name and namespace, When listing dependencies, Then notify carries that name only once', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Gone',
          RefMetadataComponentNamespace: null,
        },
        {
          Id: 'dep2',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Gone',
          RefMetadataComponentNamespace: null,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([])

      // Act
      await sut.listDependencies(apexClass)

      // Assert
      expect(notifyMock).toHaveBeenCalledWith({
        kind: 'type-resolution-degraded',
        typeNames: ['Gone'],
      })
    })

    it('Given a CustomObject dependency with no matching EntityDefinition row, When listing dependencies, Then it is dropped from sObjects and notify is called with the unresolved name', async () => {
      // Arrange — two rows, one of each kind: a fixture where every row
      // fails could not tell "drop the bad one" from "drop them all".
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Present',
          RefMetadataComponentNamespace: null,
        },
        {
          Id: 'dep2',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Gone',
          RefMetadataComponentNamespace: null,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'Present',
          QualifiedApiName: 'Present__c',
          NamespacePrefix: null,
        },
      ])

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([
        { apiName: 'Present__c', aliases: ['Present__c'] },
      ])
      expect(notifyMock).toHaveBeenCalledTimes(1)
      expect(notifyMock).toHaveBeenCalledWith({
        kind: 'type-resolution-degraded',
        typeNames: ['Gone'],
      })
    })

    it('Given readByDeveloperNames rejects, When listing dependencies, Then every custom object row is dropped and notify carries all their names with the rejection', async () => {
      // Arrange — permissions, transient network, or the EXCEEDED_ID_LIMIT
      // EntityDefinition is known to throw must degrade the same way an
      // unresolved name does, never abort the whole run.
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Present',
          RefMetadataComponentNamespace: null,
        },
        {
          Id: 'dep2',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Other',
          RefMetadataComponentNamespace: null,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      const failure = new Error('EXCEEDED_ID_LIMIT')
      readByDeveloperNamesMock.mockRejectedValueOnce(failure)

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([])
      expect(notifyMock).toHaveBeenCalledTimes(1)
      expect(notifyMock).toHaveBeenCalledWith({
        kind: 'type-resolution-degraded',
        typeNames: ['Present', 'Other'],
        error: failure,
      })
    })

    it('Given readByDeveloperNames rejects with a non-Error value, When listing dependencies, Then notify carries an Error wrapping that value', async () => {
      // Arrange — a non-Error rejection value drives the false arm of the
      // instanceof normalisation.
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Present',
          RefMetadataComponentNamespace: null,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockRejectedValueOnce('boom')

      // Act
      await sut.listDependencies(apexClass)

      // Assert
      const [notice] = (notifyMock as ReturnType<typeof vi.fn>).mock
        .calls[0] as [{ error?: Error }]
      expect(notice.error).toBeInstanceOf(Error)
      expect(notice.error?.message).toContain('boom')
    })

    it('Given every CustomObject row resolves, When listing dependencies, Then notify is never called', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Present',
          RefMetadataComponentNamespace: null,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'Present',
          QualifiedApiName: 'Present__c',
          NamespacePrefix: null,
        },
      ])

      // Act
      await sut.listDependencies(apexClass)

      // Assert
      expect(notifyMock).not.toHaveBeenCalled()
    })

    it('Given an ApexClass dependency with no namespace, When listing dependencies, Then apexClasses carries an identity-mapped TypeName', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'ApexClass',
          RefMetadataComponentName: 'MyHelper',
          RefMetadataComponentNamespace: null,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.apexClasses).toEqual([
        { apiName: 'MyHelper', aliases: ['MyHelper'] },
      ])
    })

    it('Given an ApexClass dependency with an empty-string namespace, When listing dependencies, Then apexClasses carries an identity-mapped TypeName', async () => {
      // Arrange — the org emits either null or '' for a local class
      // depending on projection, and both must read as local.
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'ApexClass',
          RefMetadataComponentName: 'MyHelper',
          RefMetadataComponentNamespace: '',
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.apexClasses).toEqual([
        { apiName: 'MyHelper', aliases: ['MyHelper'] },
      ])
    })

    it('Given an ApexClass dependency from a foreign-namespace managed package, When listing dependencies, Then apexClasses carries only the dotted api name with no bare alias', async () => {
      // Arrange — a foreign package's class must always be written dotted;
      // minting a bare alias for it would create false matches against an
      // unrelated local class of the same name.
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'ApexClass',
          RefMetadataComponentName: 'PostInstallScript',
          RefMetadataComponentNamespace: 'devedapp',
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.apexClasses).toEqual([
        {
          apiName: 'devedapp.PostInstallScript',
          aliases: ['devedapp.PostInstallScript'],
        },
      ])
    })

    it("Given an ApexClass dependency from the org's own namespace, When listing dependencies, Then apexClasses carries the dotted api name and the bare alias", async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'ApexClass',
          RefMetadataComponentName: 'Mutation',
          RefMetadataComponentNamespace: ORG_NAMESPACE,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.apexClasses).toEqual([
        {
          apiName: 'namespaced.Mutation',
          aliases: ['namespaced.Mutation', 'Mutation'],
        },
      ])
    })

    // MetadataComponentDependency.RefMetadataComponentNamespace and
    // Organization.NamespacePrefix are two distinct org-supplied values;
    // nothing guarantees they agree on case, so the own-namespace comparison
    // must not assume they do.
    it("Given an ApexClass dependency's namespace differs from the org's own namespace only in case, When listing dependencies, Then apexClasses still carries the bare alias", async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'ApexClass',
          RefMetadataComponentName: 'Mutation',
          RefMetadataComponentNamespace: ORG_NAMESPACE.toUpperCase(),
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.apexClasses).toEqual([
        {
          apiName: 'NAMESPACED.Mutation',
          aliases: ['NAMESPACED.Mutation', 'Mutation'],
        },
      ])
    })

    it('Given a mix of ApexClass, StandardEntity and CustomObject dependencies, When listing dependencies, Then sObjects keeps standard entities before custom objects', async () => {
      // Arrange — pins the merge order: StandardEntity rows first, then
      // CustomObject rows, matching the order the org returned them in.
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'ApexClass',
          RefMetadataComponentName: 'MyHelper',
          RefMetadataComponentNamespace: null,
        },
        {
          Id: 'dep2',
          RefMetadataComponentType: 'StandardEntity',
          RefMetadataComponentName: 'Account',
          RefMetadataComponentNamespace: null,
        },
        {
          Id: 'dep3',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Invoice',
          RefMetadataComponentNamespace: null,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'Invoice',
          QualifiedApiName: 'Invoice__c',
          NamespacePrefix: null,
        },
      ])

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.apexClasses).toEqual([
        { apiName: 'MyHelper', aliases: ['MyHelper'] },
      ])
      expect(result.sObjects).toEqual([
        { apiName: 'Account', aliases: ['Account'] },
        { apiName: 'Invoice__c', aliases: ['Invoice__c'] },
      ])
      expect(getApexClassDependenciesMock).toHaveBeenCalledWith('123')
    })

    it('Given no ApexClass dependencies, When listing dependencies, Then apexClasses is empty', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'StandardEntity',
          RefMetadataComponentName: 'Contact',
          RefMetadataComponentNamespace: null,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.apexClasses).toEqual([])
    })

    it('Given no sObject dependencies, When listing dependencies, Then sObjects is empty', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'ApexClass',
          RefMetadataComponentName: 'MyHelper',
          RefMetadataComponentNamespace: null,
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([])
    })
  })

  describe('assessPerimeter', () => {
    it('should resolve with a not-found verdict when a perimeter class is absent from the identity rows', async () => {
      // Arrange
      readIdentitiesMock.mockResolvedValueOnce([])

      // Act
      const result = await sut.assessPerimeter(['TestClassTest'])

      // Assert
      expect(result).toEqual({
        skipped: [{ className: 'TestClassTest', reason: 'not-found' }],
        resolutions: [],
      })
    })

    it('should resolve with a not-accessible verdict when the only identity row carries a namespace prefix', async () => {
      // Arrange — installed: a closed managed package, not mutable.
      readIdentitiesMock.mockResolvedValueOnce([
        {
          Id: 'ID1',
          Name: 'TestClassTest',
          NamespacePrefix: 'et4ae5',
          ManageableState: 'installed',
        },
      ])

      // Act
      const result = await sut.assessPerimeter(['TestClassTest'])

      // Assert — a foreign row never mints a bare key, even as the only row
      // answering to that name; the bare perimeter entry is still reported
      // not-accessible rather than not-found, because `known` is derived
      // from the identity rows directly, independent of lookupKeys.
      expect(result).toEqual({
        skipped: [{ className: 'TestClassTest', reason: 'not-accessible' }],
        resolutions: [
          {
            classId: 'ID1',
            displayName: 'et4ae5.TestClassTest',
            lookupKeys: ['et4ae5.testclasstest'],
          },
        ],
      })
    })

    it('should resolve with an empty list when the identity row carries a null namespace prefix', async () => {
      // Arrange — unmanaged: source this org owns, mutable.
      readIdentitiesMock.mockResolvedValueOnce([
        {
          Id: 'ID1',
          Name: 'TestClassTest',
          NamespacePrefix: null,
          ManageableState: 'unmanaged',
        },
      ])

      // Act
      const result = await sut.assessPerimeter(['TestClassTest'])

      // Assert — a row with no namespace has no separate qualified spelling,
      // so its bare name is its only lookup key, not a duplicated pair.
      expect(result).toEqual({
        skipped: [],
        resolutions: [
          {
            classId: 'ID1',
            displayName: 'TestClassTest',
            lookupKeys: ['testclasstest'],
          },
        ],
      })
    })

    it('should resolve with an empty list when the identity row carries an empty-string namespace prefix', async () => {
      // Arrange — unmanaged: source this org owns, mutable.
      readIdentitiesMock.mockResolvedValueOnce([
        {
          Id: 'ID1',
          Name: 'TestClassTest',
          NamespacePrefix: '',
          ManageableState: 'unmanaged',
        },
      ])

      // Act
      const result = await sut.assessPerimeter(['TestClassTest'])

      // Assert
      expect(result).toEqual({
        skipped: [],
        resolutions: [
          {
            classId: 'ID1',
            displayName: 'TestClassTest',
            lookupKeys: ['testclasstest'],
          },
        ],
      })
    })

    it('should resolve with an empty list when one of two rows sharing a name is local', async () => {
      // Arrange — a managed and a local class can share a name; any local
      // row makes the perimeter entry usable.
      readIdentitiesMock.mockResolvedValueOnce([
        {
          Id: 'ID1',
          Name: 'TestClassTest',
          NamespacePrefix: 'et4ae5',
          ManageableState: 'installed',
        },
        {
          Id: 'ID2',
          Name: 'TestClassTest',
          NamespacePrefix: null,
          ManageableState: 'unmanaged',
        },
      ])

      // Act
      const result = await sut.assessPerimeter(['TestClassTest'])

      // Assert — the bare name is shared, so the managed row does not mint
      // it; the local row answers to it regardless, since it has no other
      // spelling to begin with.
      expect(result).toEqual({
        skipped: [],
        resolutions: [
          {
            classId: 'ID1',
            displayName: 'et4ae5.TestClassTest',
            lookupKeys: ['et4ae5.testclasstest'],
          },
          {
            classId: 'ID2',
            displayName: 'TestClassTest',
            lookupKeys: ['testclasstest'],
          },
        ],
      })
    })

    it('should resolve with an empty list when the org-reported name differs only in case', async () => {
      // Arrange — the join is case-folded both ways so a differently-cased
      // org row still matches the perimeter entry.
      readIdentitiesMock.mockResolvedValueOnce([
        {
          Id: 'ID1',
          Name: 'FooTest',
          NamespacePrefix: null,
          ManageableState: 'unmanaged',
        },
      ])

      // Act
      const result = await sut.assessPerimeter(['footest'])

      // Assert
      expect(result).toEqual({
        skipped: [],
        resolutions: [
          {
            classId: 'ID1',
            displayName: 'FooTest',
            lookupKeys: ['footest'],
          },
        ],
      })
    })

    // A three-class perimeter with the first AND last entries unusable is what
    // catches a reducer that stops at the first bad entry.
    it('should name exactly the unusable entries, in perimeter order, when the first and last of a three-class perimeter are unusable', async () => {
      // Arrange
      readIdentitiesMock.mockResolvedValueOnce([
        {
          Id: 'ID1',
          Name: 'Usable',
          NamespacePrefix: null,
          ManageableState: 'unmanaged',
        },
        {
          Id: 'ID2',
          Name: 'NotATest',
          NamespacePrefix: 'et4ae5',
          ManageableState: 'installed',
        },
      ])

      // Act
      const result = await sut.assessPerimeter([
        'Missing',
        'Usable',
        'NotATest',
      ])

      // Assert
      expect(result).toEqual({
        skipped: [
          { className: 'Missing', reason: 'not-found' },
          { className: 'NotATest', reason: 'not-accessible' },
        ],
        resolutions: [
          {
            classId: 'ID1',
            displayName: 'Usable',
            lookupKeys: ['usable'],
          },
          {
            classId: 'ID2',
            displayName: 'et4ae5.NotATest',
            lookupKeys: ['et4ae5.notatest'],
          },
        ],
      })
    })

    it('should return verdicts carrying no suiteNames', async () => {
      // Arrange
      readIdentitiesMock.mockResolvedValueOnce([])

      // Act
      const {
        skipped: [verdict],
      } = await sut.assessPerimeter(['TestClassTest'])

      // Assert
      expect(verdict.suiteNames).toBeUndefined()
    })

    it('should propagate a rejecting readIdentities untouched', async () => {
      // Arrange
      const failure = new Error('org unavailable')
      readIdentitiesMock.mockRejectedValueOnce(failure)

      // Act & Assert
      await expect(sut.assessPerimeter(['TestClassTest'])).rejects.toThrow(
        'org unavailable'
      )
    })

    it('should issue exactly one readIdentities call for the whole perimeter', async () => {
      // Arrange
      const perimeter = ['A', 'B', 'C']
      readIdentitiesMock.mockResolvedValueOnce([
        {
          Id: 'ID_A',
          Name: 'A',
          NamespacePrefix: null,
          ManageableState: 'unmanaged',
        },
        {
          Id: 'ID_B',
          Name: 'B',
          NamespacePrefix: null,
          ManageableState: 'unmanaged',
        },
        {
          Id: 'ID_C',
          Name: 'C',
          NamespacePrefix: null,
          ManageableState: 'unmanaged',
        },
      ])

      // Act
      await sut.assessPerimeter(perimeter)

      // Assert — pins the cost claim and guards against a regression to
      // per-class reads.
      expect(readIdentitiesMock).toHaveBeenCalledTimes(1)
      expect(readIdentitiesMock).toHaveBeenCalledWith(perimeter)
    })

    // Two ids, one bare name: both rows must be present, or the merge that Id
    // identity prevents is never demonstrated to be prevented.
    const CLASS_ID_LOCAL = '01p000000000001'
    const CLASS_ID_FOREIGN = '01p000000000002'
    const CLASS_ID_OTHER = '01p000000000003'

    it("should mint the bare spelling for the org's own row and withhold it from the contesting foreign row", async () => {
      // Arrange — the local row carries the org's OWN namespace explicitly
      // (rather than null), so the outcome genuinely turns on the
      // own-namespace check rather than on having no namespace to qualify.
      readIdentitiesMock.mockResolvedValueOnce([
        {
          Id: CLASS_ID_LOCAL,
          Name: 'Argument',
          NamespacePrefix: ORG_NAMESPACE,
          ManageableState: 'unmanaged',
        },
        {
          Id: CLASS_ID_FOREIGN,
          Name: 'Argument',
          NamespacePrefix: 'mockery',
          ManageableState: 'installed',
        },
      ])

      // Act
      const result = await sut.assessPerimeter(['Argument'])

      // Assert — both rows share the bare name 'Argument', so only the
      // org's own row answers to it; the foreign row answers to its
      // qualified spelling alone.
      expect(result.resolutions).toEqual([
        {
          classId: CLASS_ID_LOCAL,
          displayName: `${ORG_NAMESPACE}.Argument`,
          lookupKeys: ['argument', `${ORG_NAMESPACE}.argument`],
        },
        {
          classId: CLASS_ID_FOREIGN,
          displayName: 'mockery.Argument',
          lookupKeys: ['mockery.argument'],
        },
      ])
    })

    it('should resolve one resolution per org row, not per perimeter entry', async () => {
      // Arrange — one perimeter entry, two matching org rows
      readIdentitiesMock.mockResolvedValueOnce([
        {
          Id: CLASS_ID_LOCAL,
          Name: 'Argument',
          NamespacePrefix: null,
          ManageableState: 'unmanaged',
        },
        {
          Id: CLASS_ID_FOREIGN,
          Name: 'Argument',
          NamespacePrefix: 'mockery',
          ManageableState: 'installed',
        },
      ])

      // Act
      const result = await sut.assessPerimeter(['Argument'])

      // Assert
      expect(result.resolutions.length).toBe(2)
    })

    it('should mint only the qualified spelling for a foreign row even when it is the sole claimant of its bare name', async () => {
      // Arrange — no other row in the set answers to 'ArgumentTest' either,
      // but being the sole claimant is no longer what decides this: a bare
      // spelling is legal source only inside the namespace that owns it, and
      // this row is foreign, so it never mints one — the exact write-
      // perimeter defect this pins closed.
      readIdentitiesMock.mockResolvedValueOnce([
        {
          Id: CLASS_ID_FOREIGN,
          Name: 'ArgumentTest',
          NamespacePrefix: 'mockery',
          ManageableState: 'installed',
        },
      ])

      // Act
      const result = await sut.assessPerimeter(['mockery.ArgumentTest'])

      // Assert
      expect(result.resolutions).toEqual([
        {
          classId: CLASS_ID_FOREIGN,
          displayName: 'mockery.ArgumentTest',
          lookupKeys: ['mockery.argumenttest'],
        },
      ])
    })

    it('should mint no bare key for either row when two foreign rows share a bare name', async () => {
      // Arrange — neither row is the org's own namespace, so a bare
      // perimeter entry must resolve to neither rather than to an
      // arbitrary one of them.
      readIdentitiesMock.mockResolvedValueOnce([
        {
          Id: CLASS_ID_FOREIGN,
          Name: 'Argument',
          NamespacePrefix: 'mockery',
          ManageableState: 'installed',
        },
        {
          Id: CLASS_ID_OTHER,
          Name: 'Argument',
          NamespacePrefix: 'other',
          ManageableState: 'installed',
        },
      ])

      // Act
      const result = await sut.assessPerimeter([
        'mockery.Argument',
        'other.Argument',
      ])

      // Assert
      expect(result.resolutions).toEqual([
        {
          classId: CLASS_ID_FOREIGN,
          displayName: 'mockery.Argument',
          lookupKeys: ['mockery.argument'],
        },
        {
          classId: CLASS_ID_OTHER,
          displayName: 'other.Argument',
          lookupKeys: ['other.argument'],
        },
      ])
    })

    describe('mutability', () => {
      it('should resolve with an empty skipped list when an own-namespace released row is mutable', async () => {
        // Arrange — MutationTest as reported by dev-namespaced: released and
        // carrying the org's own namespace, the acceptance command's own case.
        readIdentitiesMock.mockResolvedValueOnce([
          {
            Id: '01p000000000004',
            Name: 'MutationTest',
            NamespacePrefix: ORG_NAMESPACE,
            ManageableState: 'released',
          },
        ])

        // Act
        const result = await sut.assessPerimeter(['MutationTest'])

        // Assert
        expect(result.skipped).toEqual([])
      })

      it('should resolve with a not-accessible verdict when a null-namespace row is installed', async () => {
        // Arrange — separates the mutability rule from the namespace rule:
        // no namespace, yet still a closed managed-package state.
        readIdentitiesMock.mockResolvedValueOnce([
          {
            Id: '01p000000000005',
            Name: 'LegacyInstalled',
            NamespacePrefix: null,
            ManageableState: 'installed',
          },
        ])

        // Act
        const result = await sut.assessPerimeter(['LegacyInstalled'])

        // Assert
        expect(result.skipped).toEqual([
          { className: 'LegacyInstalled', reason: 'not-accessible' },
        ])
      })

      it('should resolve with a not-accessible verdict when a row carries a null ManageableState', async () => {
        // Arrange — an unrecognised/absent state fails closed; this is also
        // the shape a local `aer` backend produces, since it omits the field.
        readIdentitiesMock.mockResolvedValueOnce([
          {
            Id: '01p000000000006',
            Name: 'MutationTest',
            NamespacePrefix: null,
            ManageableState: null,
          },
        ])

        // Act
        const result = await sut.assessPerimeter(['MutationTest'])

        // Assert
        expect(result.skipped).toEqual([
          { className: 'MutationTest', reason: 'not-accessible' },
        ])
      })

      it('should resolve a qualified entry as not-accessible when only the local row is mutable', async () => {
        // Arrange — a mutable LOCAL row must not make a foreign qualified
        // entry usable.
        readIdentitiesMock.mockResolvedValueOnce([
          {
            Id: CLASS_ID_LOCAL,
            Name: 'Argument',
            NamespacePrefix: null,
            ManageableState: 'installedEditable',
          },
          {
            Id: CLASS_ID_FOREIGN,
            Name: 'Argument',
            NamespacePrefix: 'mockery',
            ManageableState: 'installed',
          },
        ])

        // Act
        const result = await sut.assessPerimeter(['mockery.Argument'])

        // Assert
        expect(result.skipped).toEqual([
          { className: 'mockery.Argument', reason: 'not-accessible' },
        ])
      })

      it('should resolve a qualified entry as accessible when only the foreign row is mutable', async () => {
        // Arrange — states inverted from the previous case: now the FOREIGN
        // row is the mutable one.
        readIdentitiesMock.mockResolvedValueOnce([
          {
            Id: CLASS_ID_LOCAL,
            Name: 'Argument',
            NamespacePrefix: null,
            ManageableState: 'installed',
          },
          {
            Id: CLASS_ID_FOREIGN,
            Name: 'Argument',
            NamespacePrefix: 'mockery',
            ManageableState: 'installedEditable',
          },
        ])

        // Act
        const result = await sut.assessPerimeter(['mockery.Argument'])

        // Assert
        expect(result.skipped).toEqual([])
      })

      it("should echo the caller's exact-case spelling when the entry is unusable", async () => {
        // Arrange
        readIdentitiesMock.mockResolvedValueOnce([])

        // Act
        const result = await sut.assessPerimeter(['MOCKERY.ARGUMENT'])

        // Assert
        expect(result.skipped).toEqual([
          { className: 'MOCKERY.ARGUMENT', reason: 'not-found' },
        ])
      })
    })
  })

  describe('readTestSuiteMembers', () => {
    it('should delegate to the suite repository and resolve with its rows', async () => {
      // Arrange
      const members = [{ suiteName: 'Alpha', className: 'AlphaTest' }]
      readMembersMock.mockResolvedValueOnce(members)

      // Act
      const result = await sut.readTestSuiteMembers(['Alpha'])

      // Assert
      expect(result).toEqual(members)
      expect(readMembersMock).toHaveBeenCalledWith(['Alpha'])
    })
  })

  describe('readExistingTestSuiteNames', () => {
    it('should delegate to the suite repository and resolve with its rows', async () => {
      // Arrange
      readExistingSuiteNamesMock.mockResolvedValueOnce(['Alpha'])

      // Act
      const result = await sut.readExistingTestSuiteNames(['Alpha', 'Nope'])

      // Assert
      expect(result).toEqual(['Alpha'])
      expect(readExistingSuiteNamesMock).toHaveBeenCalledWith(['Alpha', 'Nope'])
    })
  })
})
