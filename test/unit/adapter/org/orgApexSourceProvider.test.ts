import type { ApexClassRepository } from '../../../../src/adapter/org/apexClassRepository.js'
import type { ApexTestSuiteRepository } from '../../../../src/adapter/org/apexTestSuiteRepository.js'
import type { EntityDefinitionRepository } from '../../../../src/adapter/org/entityDefinitionRepository.js'
import type { MetadataComponentDependency } from '../../../../src/adapter/org/MetadataComponentDependency.js'
import { OrgApexSourceProvider } from '../../../../src/adapter/org/orgApexSourceProvider.js'
import type { EngineNotify } from '../../../../src/port/executionEngine.js'
import type { ApexClass } from '../../../../src/type/ApexClass.js'

describe('OrgApexSourceProvider', () => {
  let sut: OrgApexSourceProvider
  let readMock: ReturnType<typeof vi.fn>
  let readIdentitiesMock: ReturnType<typeof vi.fn>
  let getApexClassDependenciesMock: ReturnType<typeof vi.fn>
  let readMembersMock: ReturnType<typeof vi.fn>
  let readExistingSuiteNamesMock: ReturnType<typeof vi.fn>
  let readByDeveloperNamesMock: ReturnType<typeof vi.fn>
  let notifyMock: EngineNotify

  beforeEach(() => {
    // Arrange
    readMock = vi.fn()
    readIdentitiesMock = vi.fn()
    getApexClassDependenciesMock = vi.fn()
    readMembersMock = vi.fn()
    readExistingSuiteNamesMock = vi.fn()
    readByDeveloperNamesMock = vi.fn().mockResolvedValue([])
    notifyMock = vi.fn()

    const repository = {
      read: readMock,
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
      notifyMock
    )
  })

  describe('classExists', () => {
    it('should resolve false when the repository finds no matching row', async () => {
      // Arrange
      readMock.mockResolvedValueOnce(null)

      // Act
      const result = await sut.classExists('TestClass')

      // Assert
      expect(result).toBe(false)
    })

    it('should resolve true when the repository finds a matching row', async () => {
      // Arrange
      readMock.mockResolvedValueOnce({ Id: '123' })

      // Act
      const result = await sut.classExists('TestClass')

      // Assert
      expect(result).toBe(true)
    })

    it('should read only a minimal projection rather than every ApexClass field', async () => {
      // Arrange — the existence check only needs `!apexClass`; a wildcard
      // read would drag Body and SymbolTable for no reason, and readClass
      // re-reads the class in full when mutation actually starts.
      readMock.mockResolvedValueOnce({ Id: '123' })

      // Act
      await sut.classExists('TestClass')

      // Assert
      expect(readMock).toHaveBeenCalledWith('TestClass', ['Id'])
    })
  })

  describe('readClass', () => {
    it('should resolve with the full class row returned by the repository', async () => {
      // Arrange
      const mockApexClass = { Id: '123', Body: 'class TestClass {}' }
      readMock.mockResolvedValueOnce(mockApexClass)

      // Act
      const result = await sut.readClass('TestClass')

      // Assert
      expect(result).toEqual(mockApexClass)
      expect(readMock).toHaveBeenCalledWith('TestClass')
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

    it('Given a namespaced CustomObject dependency, When listing dependencies, Then sObjects carries the qualified api name and the bare alias', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'ProbeObj',
          RefMetadataComponentNamespace: 'namespaced',
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'ProbeObj',
          QualifiedApiName: 'namespaced__ProbeObj__c',
          NamespacePrefix: 'namespaced',
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

    it('Given an EntityDefinition row whose qualified name does not carry the row namespace, When listing dependencies, Then no bare alias is derived', async () => {
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
          RefMetadataComponentNamespace: 'namespaced',
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'Other',
          QualifiedApiName: 'Other__c',
          NamespacePrefix: 'namespaced',
        },
      ])

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([
        { apiName: 'Other__c', aliases: ['Other__c'] },
      ])
    })

    it('Given two EntityDefinition rows sharing a developer name in different namespaces, When listing dependencies, Then each dependency row picks the row matching its own namespace', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Thing',
          RefMetadataComponentNamespace: 'nsA',
        },
        {
          Id: 'dep2',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Thing',
          RefMetadataComponentNamespace: 'nsB',
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)
      readByDeveloperNamesMock.mockResolvedValueOnce([
        {
          DeveloperName: 'Thing',
          QualifiedApiName: 'nsA__Thing__c',
          NamespacePrefix: 'nsA',
        },
        {
          DeveloperName: 'Thing',
          QualifiedApiName: 'nsB__Thing__c',
          NamespacePrefix: 'nsB',
        },
      ])

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([
        { apiName: 'nsA__Thing__c', aliases: ['nsA__Thing__c', 'Thing__c'] },
        { apiName: 'nsB__Thing__c', aliases: ['nsB__Thing__c', 'Thing__c'] },
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

    it('Given an ApexClass dependency from a managed package, When listing dependencies, Then apexClasses carries the dotted api name and the bare alias', async () => {
      // Arrange
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
          aliases: ['devedapp.PostInstallScript', 'PostInstallScript'],
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
      expect(result).toEqual([
        { className: 'TestClassTest', reason: 'not-found' },
      ])
    })

    it('should resolve with a not-accessible verdict when the only identity row carries a namespace prefix', async () => {
      // Arrange
      readIdentitiesMock.mockResolvedValueOnce([
        { Name: 'TestClassTest', NamespacePrefix: 'et4ae5' },
      ])

      // Act
      const result = await sut.assessPerimeter(['TestClassTest'])

      // Assert
      expect(result).toEqual([
        { className: 'TestClassTest', reason: 'not-accessible' },
      ])
    })

    it('should resolve with an empty list when the identity row carries a null namespace prefix', async () => {
      // Arrange
      readIdentitiesMock.mockResolvedValueOnce([
        { Name: 'TestClassTest', NamespacePrefix: null },
      ])

      // Act
      const result = await sut.assessPerimeter(['TestClassTest'])

      // Assert
      expect(result).toEqual([])
    })

    it('should resolve with an empty list when the identity row carries an empty-string namespace prefix', async () => {
      // Arrange
      readIdentitiesMock.mockResolvedValueOnce([
        { Name: 'TestClassTest', NamespacePrefix: '' },
      ])

      // Act
      const result = await sut.assessPerimeter(['TestClassTest'])

      // Assert
      expect(result).toEqual([])
    })

    it('should resolve with an empty list when one of two rows sharing a name is local', async () => {
      // Arrange — a managed and a local class can share a name; any local
      // row makes the perimeter entry usable.
      readIdentitiesMock.mockResolvedValueOnce([
        { Name: 'TestClassTest', NamespacePrefix: 'et4ae5' },
        { Name: 'TestClassTest', NamespacePrefix: null },
      ])

      // Act
      const result = await sut.assessPerimeter(['TestClassTest'])

      // Assert
      expect(result).toEqual([])
    })

    it('should resolve with an empty list when the org-reported name differs only in case', async () => {
      // Arrange — the join is case-folded both ways so a differently-cased
      // org row still matches the perimeter entry.
      readIdentitiesMock.mockResolvedValueOnce([
        { Name: 'FooTest', NamespacePrefix: null },
      ])

      // Act
      const result = await sut.assessPerimeter(['footest'])

      // Assert
      expect(result).toEqual([])
    })

    // A three-class perimeter with the first AND last entries unusable is what
    // catches a reducer that stops at the first bad entry.
    it('should name exactly the unusable entries, in perimeter order, when the first and last of a three-class perimeter are unusable', async () => {
      // Arrange
      readIdentitiesMock.mockResolvedValueOnce([
        { Name: 'Usable', NamespacePrefix: null },
        { Name: 'NotATest', NamespacePrefix: 'et4ae5' },
      ])

      // Act
      const result = await sut.assessPerimeter([
        'Missing',
        'Usable',
        'NotATest',
      ])

      // Assert
      expect(result).toEqual([
        { className: 'Missing', reason: 'not-found' },
        { className: 'NotATest', reason: 'not-accessible' },
      ])
    })

    it('should return verdicts carrying no suiteNames', async () => {
      // Arrange
      readIdentitiesMock.mockResolvedValueOnce([])

      // Act
      const [verdict] = await sut.assessPerimeter(['TestClassTest'])

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
        { Name: 'A', NamespacePrefix: null },
        { Name: 'B', NamespacePrefix: null },
        { Name: 'C', NamespacePrefix: null },
      ])

      // Act
      await sut.assessPerimeter(perimeter)

      // Assert — pins the cost claim and guards against a regression to
      // per-class reads.
      expect(readIdentitiesMock).toHaveBeenCalledTimes(1)
      expect(readIdentitiesMock).toHaveBeenCalledWith(perimeter)
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
