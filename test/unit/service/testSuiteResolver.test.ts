import { Messages } from '@salesforce/core'
import { TestSuiteResolver } from '../../../src/service/testSuiteResolver.js'
import { ApexMutationParameter } from '../../../src/type/ApexMutationParameter.js'
import { fakeSourceProvider } from '../../utils/testUtil.js'

describe('TestSuiteResolver', () => {
  let sut: TestSuiteResolver
  let sourceMock: ReturnType<typeof fakeSourceProvider>
  let messagesMock: Messages<string>
  const baseParameter: ApexMutationParameter = {
    apexClassName: 'MyClass',
    apexTestClassNames: ['MyClassTest'],
    reportDir: 'reports',
  }

  beforeEach(() => {
    sourceMock = fakeSourceProvider()
    messagesMock = {
      getMessage: vi.fn((key: string, args?: string[]) => {
        const templates: Record<string, string> = {
          'error.testSuiteNotFound': `Apex test suite '${args?.[0]}' not found`,
          'error.testSuiteEmpty': `Apex test suite '${args?.[0]}' contains no Apex test classes`,
        }
        return templates[key] ?? key
      }),
    } as unknown as Messages<string>
    sut = new TestSuiteResolver(sourceMock, messagesMock)
  })

  describe('given no apexTestSuiteNames key', () => {
    it('then returns the parameter unchanged and never queries the repository', async () => {
      // Arrange
      const parameter = { ...baseParameter }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result).toBe(parameter)
      expect(result.testClassOrigins).toBeUndefined()
      expect(sourceMock.readTestSuiteMembers).not.toHaveBeenCalled()
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
      expect(sourceMock.readTestSuiteMembers).not.toHaveBeenCalled()
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
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([
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
      expect(result.testClassOrigins).toEqual(
        new Map([
          ['alphatesta', ['Alpha']],
          ['alphatestb', ['Alpha']],
          ['alphatestc', ['Alpha']],
        ])
      )
      expect(result).not.toBe(parameter)
      expect(parameter.apexTestClassNames).toEqual([])
      expect(sourceMock.readTestSuiteMembers).toHaveBeenCalledWith(['Alpha'])
      expect(sourceMock.readExistingTestSuiteNames).not.toHaveBeenCalled()
    })
  })

  describe('given two suites whose members have different class names', () => {
    it('then groups the perimeter by requested suite order, not by class name', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: [],
        apexTestSuiteNames: ['Zed', 'Alpha'],
      }
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'AlphaTest' },
        { suiteName: 'Zed', className: 'ZedTest' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['ZedTest', 'AlphaTest'])
    })
  })

  describe('given suites named in reverse alphabetical order sharing a class', () => {
    it('then the shared class lists the suites in flag order, not adapter order', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: [],
        apexTestSuiteNames: ['Zed', 'Alpha'],
      }
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'SharedTest' },
        { suiteName: 'Zed', className: 'SharedTest' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.testClassOrigins).toEqual(
        new Map([['sharedtest', ['Zed', 'Alpha']]])
      )
    })
  })

  describe('given a requested suite whose only match differs by case', () => {
    it('then treats the wrong-case name as unresolved', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: [],
        apexTestSuiteNames: ['Alpha', 'alpha'],
      }
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'AlphaTest' },
      ])
      vi.mocked(sourceMock.readExistingTestSuiteNames).mockResolvedValue([])

      // Act
      const result = sut.resolve(parameter)

      // Assert
      await expect(result).rejects.toThrow("Apex test suite 'alpha' not found")
      expect(sourceMock.readExistingTestSuiteNames).toHaveBeenCalledWith([
        'alpha',
      ])
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
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'SharedTest' },
        { suiteName: 'Beta', className: 'SharedTest' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['SharedTest'])
      expect(result.testClassOrigins).toEqual(
        new Map([['sharedtest', ['Alpha', 'Beta']]])
      )
    })
  })

  describe('given a suite member also passed via the CLI test-class flag, in a different case', () => {
    it('then keeps a single entry using the CLI spelling and records no origin for it', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['sHAREDtest'],
        apexTestSuiteNames: ['Alpha'],
      }
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'SharedTest' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['sHAREDtest'])
      expect(result.testClassOrigins).toEqual(new Map())
    })
  })

  describe('given two suites contributing the same class under different casing', () => {
    it('then the origins map holds one entry listing both suites in flag order', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: [],
        apexTestSuiteNames: ['Alpha', 'Beta'],
      }
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'BarTest' },
        { suiteName: 'Beta', className: 'bartest' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.testClassOrigins).toEqual(
        new Map([['bartest', ['Alpha', 'Beta']]])
      )
      expect(result.apexTestClassNames).toEqual(['BarTest'])
    })
  })

  describe('given a suite name typed in mixed case', () => {
    it('then echoes the suite name case-exact while folding the class key', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: [],
        apexTestSuiteNames: ['MySuite'],
      }
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([
        { suiteName: 'MySuite', className: 'AlphaTest' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.testClassOrigins).toEqual(
        new Map([['alphatest', ['MySuite']]])
      )
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
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([
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
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([])
      vi.mocked(sourceMock.readExistingTestSuiteNames).mockResolvedValue([])

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Apex test suite 'Nope' not found"
      )
      expect(sourceMock.readExistingTestSuiteNames).toHaveBeenCalledWith([
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
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([])
      vi.mocked(sourceMock.readExistingTestSuiteNames).mockResolvedValue([
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
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([])
      vi.mocked(sourceMock.readExistingTestSuiteNames).mockResolvedValue([])

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
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'AlphaTest' },
      ])
      vi.mocked(sourceMock.readExistingTestSuiteNames).mockResolvedValue([])

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Apex test suite 'Nope' not found"
      )
      expect(sourceMock.readExistingTestSuiteNames).toHaveBeenCalledWith([
        'Nope',
      ])
      expect(sourceMock.readTestSuiteMembers).toHaveBeenCalledWith([
        'Alpha',
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
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'AlphaTest' },
      ])
      vi.mocked(sourceMock.readExistingTestSuiteNames).mockResolvedValue([
        'Empty',
      ])

      // Act
      const act = sut.resolve(parameter)

      // Assert
      await expect(act).rejects.toThrow(
        "Apex test suite 'Empty' contains no Apex test classes\nApex test suite 'Nope' not found"
      )
      expect(sourceMock.readExistingTestSuiteNames).toHaveBeenCalledTimes(1)
      expect(sourceMock.readExistingTestSuiteNames).toHaveBeenCalledWith([
        'Empty',
        'Nope',
      ])
    })
  })

  describe('given suite names differing only by case', () => {
    it('then each groups its own members and the union dedupes by class', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: [],
        apexTestSuiteNames: ['Foo', 'foo'],
      }
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([
        { suiteName: 'foo', className: 'AlphaTest' },
        { suiteName: 'Foo', className: 'SharedTest' },
        { suiteName: 'foo', className: 'SharedTest' },
        { suiteName: 'Foo', className: 'ZedTest' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual([
        'SharedTest',
        'ZedTest',
        'AlphaTest',
      ])
    })
  })

  describe('given a resolving invocation', () => {
    it('then every field other than apexTestClassNames and testClassOrigins passes through unchanged', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestSuiteNames: ['Alpha'],
        dryRun: true,
        threshold: 80,
      }
      vi.mocked(sourceMock.readTestSuiteMembers).mockResolvedValue([
        { suiteName: 'Alpha', className: 'AlphaTest' },
      ])

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestSuiteNames).toBe(parameter.apexTestSuiteNames)
      expect(result).toEqual({
        ...parameter,
        apexTestClassNames: result.apexTestClassNames,
        testClassOrigins: new Map([['alphatest', ['Alpha']]]),
      })
    })
  })
})
