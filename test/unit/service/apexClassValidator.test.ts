import { Connection } from '@salesforce/core'
import type { Mocked } from 'vitest'
import { ApexClassRepository } from '../../../src/adapter/apexClassRepository.js'
import {
  ApexClassNotFoundError,
  ApexClassValidator,
} from '../../../src/service/apexClassValidator.js'
import { ApexClass } from '../../../src/type/ApexClass.js'

vi.mock('../../../src/adapter/apexClassRepository.js')
const readMock = vi.fn()
const readIdentitiesMock = vi.fn()

describe('ApexClassValidator', () => {
  let sut: ApexClassValidator
  const params = {
    apexClassName: 'TestClass',
    apexTestClassNames: ['TestClassTest'],
    reportDir: 'reports',
  }

  beforeEach(() => {
    // Arrange
    vi.mocked(ApexClassRepository).mockImplementation(
      class {
        read = readMock
        readIdentities = readIdentitiesMock
      }
    )
    readMock.mockReset()
    readIdentitiesMock.mockReset()

    sut = new ApexClassValidator({} as Mocked<Connection>)
  })

  describe('validate', () => {
    it('should reject with an ApexClassNotFoundError carrying the class name when the class under mutation is unreadable', async () => {
      // Arrange
      readMock.mockResolvedValueOnce(null)

      // Act
      const result = sut.validate(params)

      // Assert
      await expect(result).rejects.toBeInstanceOf(ApexClassNotFoundError)
      await expect(result).rejects.toMatchObject({
        className: 'TestClass',
        name: 'ApexClassNotFoundError',
      })
    })

    it('should reject with a developer-facing message naming the class', async () => {
      // Arrange
      readMock.mockResolvedValueOnce(null)

      // Act
      const result = sut.validate(params)

      // Assert
      await expect(result).rejects.toMatchObject({
        message: "Apex class 'TestClass' not found",
      })
    })

    it('should resolve and read the class exactly once when the class under mutation is readable', async () => {
      // Arrange
      const mockApexClass = { Body: 'class TestClass {}' }
      readMock.mockResolvedValueOnce(mockApexClass as ApexClass)

      // Act
      await expect(sut.validate(params)).resolves.not.toThrow()

      // Assert
      expect(readMock).toHaveBeenCalledTimes(1)
    })

    it('should reject naming only the target class when the target class is unreadable and a perimeter class is independently unusable', async () => {
      // Arrange
      readMock.mockResolvedValueOnce(null)
      readIdentitiesMock.mockResolvedValueOnce([])

      // Act
      const validateResult = sut.validate(params)
      const perimeterResult = sut.assessPerimeter(params.apexTestClassNames)

      // Assert
      await expect(validateResult).rejects.toMatchObject({
        className: 'TestClass',
      })
      await expect(perimeterResult).resolves.toEqual([
        { className: 'TestClassTest', reason: 'not-found' },
      ])
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
})
