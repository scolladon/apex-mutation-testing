import { Connection } from '@salesforce/core'
import { ApexClassRepository } from '../../../src/adapter/apexClassRepository.js'

describe('ApexClassRepository', () => {
  let connectionStub: Connection
  let sut: ApexClassRepository
  const findMock = jest.fn()
  const createMock = jest.fn()

  beforeEach(() => {
    connectionStub = {
      tooling: {
        sobject: () => ({
          find: () => ({ execute: findMock }),
          create: createMock,
        }),
      },
    } as unknown as Connection
    sut = new ApexClassRepository(connectionStub)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when reading an ApexClass', () => {
    describe('given the class exists', () => {
      it('then should return the ApexClass', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Name: 'TestClass',
          Body: 'public class TestClass {}',
        }
        findMock.mockResolvedValue([mockApexClass])

        // Act
        const result = await sut.read('TestClass')

        // Assert
        expect(result).toEqual(mockApexClass)
        expect(findMock).toHaveBeenCalledTimes(1)
      })
    })

    describe('given the class does not exist', () => {
      it('then should throw an error', async () => {
        // Arrange
        findMock.mockRejectedValue(
          new Error('ApexClass NonExistentClass not found')
        )

        // Act & Assert
        await expect(sut.read('NonExistentClass')).rejects.toThrow(
          'ApexClass NonExistentClass not found'
        )
      })
    })
  })

  describe('when updating an ApexClass', () => {
    describe('given the update is successful', () => {
      it('then should return the updated ApexClass', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }
        createMock.mockResolvedValue({ Id: '123' })

        // Act
        const result = await sut.update(mockApexClass)

        // Assert
        expect(result).toEqual({ Id: '123' })
        expect(createMock).toHaveBeenCalledWith(
          expect.objectContaining({
            IsCheckOnly: false,
            IsRunTests: true,
          })
        )
        expect(createMock).toHaveBeenCalledTimes(3)
      })
    })

    describe('given the update fails', () => {
      it('then should throw an error', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }
        createMock.mockRejectedValue(new Error('Update failed'))

        // Act & Assert
        await expect(sut.update(mockApexClass)).rejects.toThrow('Update failed')
      })
    })
  })
})
