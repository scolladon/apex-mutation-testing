import { Connection } from '@salesforce/core'
import type { Mocked } from 'vitest'
import { ApexClassRepository } from '../../../src/adapter/apexClassRepository.js'
import { ApexClassValidator } from '../../../src/service/apexClassValidator.js'
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
    it('should throw error when apex class is not found', async () => {
      // Arrange
      readMock.mockResolvedValueOnce(null)

      // Act & Assert
      await expect(sut.validate(params)).rejects.toThrow(
        'Apex class TestClass not found'
      )
    })

    it('should throw error when apex test class is not found', async () => {
      // Arrange
      const mockApexClass = { Body: 'class TestClass {}' }
      readMock
        .mockResolvedValueOnce(mockApexClass as ApexClass)
        .mockResolvedValueOnce(null)

      // Act & Assert
      await expect(sut.validate(params)).rejects.toThrow(
        'Apex test class TestClassTest not found'
      )
    })

    it('should throw error when apex test class is not annotated with @isTest', async () => {
      // Arrange
      const mockApexClass = { Body: 'class TestClass {}' }
      const mockTestClass = { Body: 'class TestClassTest {}' }
      readMock
        .mockResolvedValueOnce(mockApexClass as ApexClass)
        .mockResolvedValueOnce(mockTestClass as ApexClass)
      // Act & Assert
      await expect(sut.validate(params)).rejects.toThrow(
        'Apex test class TestClassTest is not annotated with @isTest'
      )
    })

    it('should not throw error when both classes are valid', async () => {
      // Arrange
      const mockApexClass = { Body: 'class TestClass {}' }
      const mockTestClass = { Body: '@IsTest class TestClassTest {}' }
      readMock
        .mockResolvedValueOnce(mockApexClass as ApexClass)
        .mockResolvedValueOnce(mockTestClass as ApexClass),
        // Act & Assert
        await expect(sut.validate(params)).resolves.not.toThrow()
    })

    it('should join multiple errors with newline when both classes are not found', async () => {
      // Arrange
      readMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null)

      // Act & Assert
      await expect(sut.validate(params)).rejects.toThrow(
        'Apex class TestClass not found\nApex test class TestClassTest not found'
      )
    })

    it('should resolve when the target class and every class in a multi-class perimeter are valid', async () => {
      // Arrange
      const mockApexClass = { Body: 'class TestClass {}' }
      const mockTestClassA = { Body: '@IsTest class TestClassTest {}' }
      const mockTestClassB = { Body: '@IsTest class TestClassTest2 {}' }
      readMock
        .mockResolvedValueOnce(mockApexClass as ApexClass)
        .mockResolvedValueOnce(mockTestClassA as ApexClass)
        .mockResolvedValueOnce(mockTestClassB as ApexClass)
      const multiParams = {
        ...params,
        apexTestClassNames: ['TestClassTest', 'TestClassTest2'],
      }

      // Act & Assert
      await expect(sut.validate(multiParams)).resolves.not.toThrow()
    })

    it('should name exactly the missing class when one among many perimeter classes is missing', async () => {
      // Arrange
      const mockApexClass = { Body: 'class TestClass {}' }
      const mockTestClassB = { Body: '@IsTest class TestClassTest2 {}' }
      readMock
        .mockResolvedValueOnce(mockApexClass as ApexClass)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockTestClassB as ApexClass)
      const multiParams = {
        ...params,
        apexTestClassNames: ['TestClassTest', 'TestClassTest2'],
      }

      // Act & Assert
      await expect(sut.validate(multiParams)).rejects.toThrow(
        'Apex test class TestClassTest not found'
      )
    })

    it('should join the target-class error first when the target class and one perimeter class are both invalid', async () => {
      // Arrange
      const mockTestClassB = { Body: '@IsTest class TestClassTest2 {}' }
      readMock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockTestClassB as ApexClass)
      const multiParams = {
        ...params,
        apexTestClassNames: ['TestClassTest', 'TestClassTest2'],
      }

      // Act & Assert
      await expect(sut.validate(multiParams)).rejects.toThrow(
        'Apex class TestClass not found\nApex test class TestClassTest not found'
      )
    })
  })
})
