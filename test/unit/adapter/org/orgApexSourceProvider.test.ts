import type { ApexClassRepository } from '../../../../src/adapter/org/apexClassRepository.js'
import type { ApexTestSuiteRepository } from '../../../../src/adapter/org/apexTestSuiteRepository.js'
import type { MetadataComponentDependency } from '../../../../src/adapter/org/MetadataComponentDependency.js'
import { OrgApexSourceProvider } from '../../../../src/adapter/org/orgApexSourceProvider.js'
import type { ApexClass } from '../../../../src/type/ApexClass.js'

describe('OrgApexSourceProvider', () => {
  let sut: OrgApexSourceProvider
  let readMock: ReturnType<typeof vi.fn>
  let readIdentitiesMock: ReturnType<typeof vi.fn>
  let getApexClassDependenciesMock: ReturnType<typeof vi.fn>
  let readMembersMock: ReturnType<typeof vi.fn>
  let readExistingSuiteNamesMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Arrange
    readMock = vi.fn()
    readIdentitiesMock = vi.fn()
    getApexClassDependenciesMock = vi.fn()
    readMembersMock = vi.fn()
    readExistingSuiteNamesMock = vi.fn()

    const repository = {
      read: readMock,
      readIdentities: readIdentitiesMock,
      getApexClassDependencies: getApexClassDependenciesMock,
    } as unknown as ApexClassRepository
    const suiteRepository = {
      readMembers: readMembersMock,
      readExistingSuiteNames: readExistingSuiteNamesMock,
    } as unknown as ApexTestSuiteRepository

    sut = new OrgApexSourceProvider(repository, suiteRepository)
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

    it('Given only ApexClass dependencies, When listing dependencies, Then apexClasses carries the ApexClass names only', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'ApexClass',
          RefMetadataComponentName: 'MyHelper',
        },
        {
          Id: 'dep2',
          RefMetadataComponentType: 'StandardEntity',
          RefMetadataComponentName: 'Account',
        },
        {
          Id: 'dep3',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Invoice__c',
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.apexClasses).toEqual(['MyHelper'])
      expect(getApexClassDependenciesMock).toHaveBeenCalledWith('123')
    })

    it('Given only StandardEntity and CustomObject dependencies, When listing dependencies, Then sObjects carries both merged', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'ApexClass',
          RefMetadataComponentName: 'MyHelper',
        },
        {
          Id: 'dep2',
          RefMetadataComponentType: 'StandardEntity',
          RefMetadataComponentName: 'Account',
        },
        {
          Id: 'dep3',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Invoice__c',
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual(['Account', 'Invoice__c'])
    })

    it('Given no ApexClass dependencies, When listing dependencies, Then apexClasses is empty', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'StandardEntity',
          RefMetadataComponentName: 'Contact',
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
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual([])
    })

    it('Given a CustomObject dependency only, When listing dependencies, Then sObjects carries the CustomObject name', async () => {
      // Arrange
      const dependencies: MetadataComponentDependency[] = [
        {
          Id: 'dep1',
          RefMetadataComponentType: 'CustomObject',
          RefMetadataComponentName: 'Order__c',
        },
      ]
      getApexClassDependenciesMock.mockResolvedValueOnce(dependencies)

      // Act
      const result = await sut.listDependencies(apexClass)

      // Assert
      expect(result.sObjects).toEqual(['Order__c'])
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
