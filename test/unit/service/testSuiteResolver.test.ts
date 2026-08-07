import { Messages } from '@salesforce/core'
import { ApexTestSuiteRepository } from '../../../src/adapter/apexTestSuiteRepository.js'
import { TestSuiteResolver } from '../../../src/service/testSuiteResolver.js'
import { ApexMutationParameter } from '../../../src/type/ApexMutationParameter.js'

describe('TestSuiteResolver', () => {
  let sut: TestSuiteResolver
  let repositoryMock: ApexTestSuiteRepository
  let messagesMock: Messages<string>
  const baseParameter: ApexMutationParameter = {
    apexClassName: 'MyClass',
    apexTestClassNames: ['MyClassTest'],
    reportDir: 'reports',
  }

  beforeEach(() => {
    repositoryMock = {
      readMembers: vi.fn(),
      readExistingSuiteNames: vi.fn(),
    } as unknown as ApexTestSuiteRepository
    messagesMock = {
      getMessage: vi.fn((key: string, args?: string[]) => {
        const templates: Record<string, string> = {
          'error.testSuiteNotFound': `Apex test suite '${args?.[0]}' not found`,
          'error.testSuiteEmpty': `Apex test suite '${args?.[0]}' contains no Apex test classes`,
        }
        return templates[key] ?? key
      }),
    } as unknown as Messages<string>
    sut = new TestSuiteResolver(repositoryMock, messagesMock)
  })

  describe('given no apexTestSuiteNames key', () => {
    it('then returns the parameter unchanged and never queries the repository', async () => {
      // Arrange
      const parameter = { ...baseParameter }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result).toBe(parameter)
      expect(repositoryMock.readMembers).not.toHaveBeenCalled()
    })
  })

  describe('given an empty apexTestSuiteNames array', () => {
    it('then returns the parameter unchanged and never queries the repository', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestSuiteNames: [],
      }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result).toBe(parameter)
      expect(repositoryMock.readMembers).not.toHaveBeenCalled()
    })
  })

  describe('given one suite with three members', () => {
    it('then composes a new perimeter in adapter order without mutating the input', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: [],
        apexTestSuiteNames: ['Alpha'],
      }
      vi.mocked(repositoryMock.readMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'AlphaTestA' },
        { suiteName: 'Alpha', className: 'AlphaTestB' },
        { suiteName: 'Alpha', className: 'AlphaTestC' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual([
        'AlphaTestA',
        'AlphaTestB',
        'AlphaTestC',
      ])
      expect(result).not.toBe(parameter)
      expect(parameter.apexTestClassNames).toEqual([])
    })
  })

  describe('given two suites sharing a class', () => {
    it('then the shared class appears once in the perimeter', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: [],
        apexTestSuiteNames: ['Alpha', 'Beta'],
      }
      vi.mocked(repositoryMock.readMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'SharedTest' },
        { suiteName: 'Beta', className: 'SharedTest' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['SharedTest'])
    })
  })

  describe('given a suite member also passed via the CLI test-class flag', () => {
    it('then keeps a single entry using the first-seen CLI spelling', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['sharedtest'],
        apexTestSuiteNames: ['Alpha'],
      }
      vi.mocked(repositoryMock.readMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'SharedTest' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['sharedtest'])
    })
  })

  describe('given CLI test classes and non-overlapping suite members', () => {
    it('then orders CLI classes first, followed by suite members', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['CliTest'],
        apexTestSuiteNames: ['Alpha'],
      }
      vi.mocked(repositoryMock.readMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'AlphaTest' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['CliTest', 'AlphaTest'])
    })
  })

  describe('given an unknown suite', () => {
    it('then classifies it as not-found using exactly the failing name', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestSuiteNames: ['Nope'],
      }
      vi.mocked(repositoryMock.readMembers).mockResolvedValue([])
      vi.mocked(repositoryMock.readExistingSuiteNames).mockResolvedValue([])

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Apex test suite 'Nope' not found"
      )
      expect(repositoryMock.readExistingSuiteNames).toHaveBeenCalledWith([
        'Nope',
      ])
    })
  })

  describe('given an empty suite', () => {
    it('then classifies it as empty, distinct from the not-found message', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestSuiteNames: ['Empty'],
      }
      vi.mocked(repositoryMock.readMembers).mockResolvedValue([])
      vi.mocked(repositoryMock.readExistingSuiteNames).mockResolvedValue([
        'Empty',
      ])

      // Act
      const act = sut.resolve(parameter)

      // Assert
      await expect(act).rejects.toThrow(
        "Apex test suite 'Empty' contains no Apex test classes"
      )
      await expect(act).rejects.not.toThrow("Apex test suite 'Empty' not found")
    })
  })

  describe('given a wrong-case suite name', () => {
    it('then classifies it as not-found, not as empty', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestSuiteNames: ['alpha'],
      }
      vi.mocked(repositoryMock.readMembers).mockResolvedValue([])
      vi.mocked(repositoryMock.readExistingSuiteNames).mockResolvedValue([])

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Apex test suite 'alpha' not found"
      )
    })
  })

  describe('given two suites where one resolves and one does not', () => {
    it('then rejects and queries readExistingSuiteNames with only the failing name', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestSuiteNames: ['Alpha', 'Nope'],
      }
      vi.mocked(repositoryMock.readMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'AlphaTest' },
      ])
      vi.mocked(repositoryMock.readExistingSuiteNames).mockResolvedValue([])

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Apex test suite 'Nope' not found"
      )
      expect(repositoryMock.readExistingSuiteNames).toHaveBeenCalledWith([
        'Nope',
      ])
    })
  })

  describe('given three suites where one is empty and one is absent', () => {
    it('then issues a single classification query for both names and joins both error lines', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestSuiteNames: ['Alpha', 'Empty', 'Nope'],
      }
      vi.mocked(repositoryMock.readMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'AlphaTest' },
      ])
      vi.mocked(repositoryMock.readExistingSuiteNames).mockResolvedValue([
        'Empty',
      ])

      // Act
      const act = sut.resolve(parameter)

      // Assert
      await expect(act).rejects.toThrow(
        "Apex test suite 'Empty' contains no Apex test classes\nApex test suite 'Nope' not found"
      )
      expect(repositoryMock.readExistingSuiteNames).toHaveBeenCalledTimes(1)
      expect(repositoryMock.readExistingSuiteNames).toHaveBeenCalledWith([
        'Empty',
        'Nope',
      ])
    })
  })

  describe('given suite names differing only by case', () => {
    it('then both suites resolve independently and their members union-dedupe by class', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: [],
        apexTestSuiteNames: ['Foo', 'foo'],
      }
      vi.mocked(repositoryMock.readMembers).mockResolvedValue([
        { suiteName: 'Foo', className: 'FooTest' },
        { suiteName: 'foo', className: 'FooTest' },
        { suiteName: 'foo', className: 'BarTest' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['FooTest', 'BarTest'])
    })
  })

  describe('given a resolving invocation', () => {
    it('then every field other than apexTestClassNames passes through unchanged', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestSuiteNames: ['Alpha'],
        dryRun: true,
        threshold: 80,
      }
      vi.mocked(repositoryMock.readMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'AlphaTest' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestSuiteNames).toBe(parameter.apexTestSuiteNames)
      expect(result).toEqual({
        ...parameter,
        apexTestClassNames: result.apexTestClassNames,
      })
    })
  })
})
