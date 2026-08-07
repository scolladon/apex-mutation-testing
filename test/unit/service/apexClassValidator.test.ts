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
      }
    )
    readMock.mockReset()

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
      readMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null)

      // Act
      const validateResult = sut.validate(params)
      const perimeterResult = sut.assessPerimeter(params.apexTestClassNames)

      // Assert
      await expect(validateResult).rejects.toMatchObject({
        className: 'TestClass',
      })
      await expect(perimeterResult).resolves.toEqual([
        { className: 'TestClassTest', reason: 'not-readable' },
      ])
    })
  })

  describe('assessPerimeter', () => {
    it('should resolve with a not-readable verdict when a perimeter class cannot be read', async () => {
      // Arrange
      readMock.mockResolvedValueOnce(null)

      // Act
      const result = await sut.assessPerimeter(['TestClassTest'])

      // Assert
      expect(result).toEqual([
        { className: 'TestClassTest', reason: 'not-readable' },
      ])
    })

    it('should resolve with a not-a-test-class verdict when a perimeter class has no @isTest annotation', async () => {
      // Arrange
      const mockTestClass = { Body: 'class TestClassTest {}' }
      readMock.mockResolvedValueOnce(mockTestClass as ApexClass)

      // Act
      const result = await sut.assessPerimeter(['TestClassTest'])

      // Assert
      expect(result).toEqual([
        { className: 'TestClassTest', reason: 'not-a-test-class' },
      ])
    })

    it('should resolve with an empty list when every perimeter class is a readable @isTest class', async () => {
      // Arrange
      const mockTestClassA = { Body: '@IsTest class TestClassTest {}' }
      const mockTestClassB = { Body: '@IsTest class TestClassTest2 {}' }
      readMock
        .mockResolvedValueOnce(mockTestClassA as ApexClass)
        .mockResolvedValueOnce(mockTestClassB as ApexClass)

      // Act
      const result = await sut.assessPerimeter([
        'TestClassTest',
        'TestClassTest2',
      ])

      // Assert
      expect(result).toEqual([])
    })

    // A three-class perimeter with the first AND last entries unusable is what
    // catches a reducer that stops at the first bad entry.
    it('should name exactly the unusable entries, in perimeter order, when the first and last of a three-class perimeter are unusable', async () => {
      // Arrange
      const mockUsable = { Body: '@IsTest class Usable {}' }
      readMock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUsable as ApexClass)
        .mockResolvedValueOnce({ Body: 'class NotATest {}' } as ApexClass)

      // Act
      const result = await sut.assessPerimeter([
        'Missing',
        'Usable',
        'NotATest',
      ])

      // Assert
      expect(result).toEqual([
        { className: 'Missing', reason: 'not-readable' },
        { className: 'NotATest', reason: 'not-a-test-class' },
      ])
    })

    it('should return verdicts carrying no suiteNames', async () => {
      // Arrange
      readMock.mockResolvedValueOnce(null)

      // Act
      const [verdict] = await sut.assessPerimeter(['TestClassTest'])

      // Assert
      expect(verdict.suiteNames).toBeUndefined()
    })

    it('should propagate a rejecting read untouched', async () => {
      // Arrange
      const failure = new Error('org unavailable')
      readMock.mockRejectedValueOnce(failure)

      // Act & Assert
      await expect(sut.assessPerimeter(['TestClassTest'])).rejects.toThrow(
        'org unavailable'
      )
    })
  })
})
