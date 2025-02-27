import { Connection } from '@salesforce/core'
import { ApexClassRepository } from '../../../src/adapter/apexClassRepository.js'
import { ApexClassValidator } from '../../../src/service/apexClassValidator.js'
import { ApexClass } from '../../../src/type/ApexClass.js'

jest.mock('../../../src/adapter/apexClassRepository.js')
const readMock = jest.fn()

describe('ApexClassValidator', () => {
  let sut: ApexClassValidator
  const params = {
    apexClassName: 'TestClass',
    apexTestClassName: 'TestClassTest',
    reportDir: 'reports',
  }

  beforeEach(() => {
    // Arrange
    ;(ApexClassRepository as jest.Mock).mockImplementation(() => ({
      read: readMock,
    }))
    readMock.mockReset()

    sut = new ApexClassValidator({} as jest.Mocked<Connection>)
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
  })
})
