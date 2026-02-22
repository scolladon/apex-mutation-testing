import { Connection } from '@salesforce/core'
import { ApexClassRepository } from '../../../src/adapter/apexClassRepository.js'

describe('ApexClassRepository', () => {
  let connectionStub: Connection
  let sut: ApexClassRepository
  const findMock = jest.fn()
  const createMock = jest.fn()
  const retrieveMock = jest.fn()

  beforeEach(() => {
    connectionStub = {
      tooling: {
        sobject: (objectType: string) => {
          if (objectType === 'ApexClass') {
            return {
              find: () => ({ execute: findMock }),
            }
          } else if (objectType === 'MetadataContainer') {
            return {
              create: createMock,
            }
          } else if (objectType === 'ApexClassMember') {
            return {
              create: createMock,
            }
          } else if (objectType === 'ContainerAsyncRequest') {
            return {
              create: createMock,
              retrieve: retrieveMock,
            }
          }
          return {
            find: () => ({ execute: findMock }),
            create: createMock,
            retrieve: retrieveMock,
          }
        },
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

  describe('when getting ApexClass dependencies', () => {
    it('Given a classId, When getApexClassDependencies, Then returns dependencies', async () => {
      // Arrange
      const mockDependencies = [
        { MetadataComponentId: '123', RefMetadataComponentId: '456' },
      ]
      findMock.mockResolvedValue(mockDependencies)

      // Act
      const result = await sut.getApexClassDependencies('123')

      // Assert
      expect(result).toEqual(mockDependencies)
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

        createMock
          .mockResolvedValueOnce({ id: 'container123' }) // MetadataContainer creation
          .mockResolvedValueOnce({ id: 'member123' }) // ApexClassMember creation
          .mockResolvedValueOnce({ id: 'request123' }) // ContainerAsyncRequest creation

        retrieveMock.mockResolvedValue({
          State: 'Completed',
          Id: 'request123',
        })

        // Act
        const result = await sut.update(mockApexClass)

        // Assert
        expect(result).toEqual({
          State: 'Completed',
          Id: 'request123',
        })
        expect(createMock).toHaveBeenCalledTimes(3)
        expect(retrieveMock).toHaveBeenCalledWith('request123')
      })
    })

    describe('given the ContainerAsyncRequest creation fails', () => {
      it('then should throw an error about missing ID', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }

        createMock
          .mockResolvedValueOnce({ id: 'container123' }) // MetadataContainer creation
          .mockResolvedValueOnce({ id: 'member123' }) // ApexClassMember creation
          .mockResolvedValueOnce({}) // ContainerAsyncRequest creation WITHOUT id

        // Act & Assert
        await expect(sut.update(mockApexClass)).rejects.toThrow(
          'ContainerAsyncRequest did not return an ID'
        )
      })
    })

    describe('given the deployment fails', () => {
      it('then should throw an error with deployment details', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }

        createMock
          .mockResolvedValueOnce({ id: 'container123' })
          .mockResolvedValueOnce({ id: 'member123' })
          .mockResolvedValueOnce({ id: 'request123' })

        retrieveMock.mockResolvedValue({
          State: 'Failed',
          ErrorMsg: 'Compilation error',
          DeployDetails: {
            allComponentMessages: [
              {
                fileName: 'TestClass.cls',
                lineNumber: 1,
                columnNumber: 10,
                problem: 'Missing semicolon',
              },
            ],
          },
        })

        // Act & Assert
        await expect(sut.update(mockApexClass)).rejects.toThrow(
          'Deployment failed:\n[TestClass.cls:1:10] Missing semicolon'
        )
      })
    })

    describe('given the deployment fails without component messages', () => {
      it('then should use ErrorMsg as fallback', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }

        createMock
          .mockResolvedValueOnce({ id: 'container123' })
          .mockResolvedValueOnce({ id: 'member123' })
          .mockResolvedValueOnce({ id: 'request123' })

        retrieveMock.mockResolvedValue({
          State: 'Failed',
          ErrorMsg: 'General failure',
        })

        // Act & Assert
        await expect(sut.update(mockApexClass)).rejects.toThrow(
          'Deployment failed:\nGeneral failure'
        )
      })
    })

    describe('given the deployment fails without any error details', () => {
      it('then should use Unknown error as fallback', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }

        createMock
          .mockResolvedValueOnce({ id: 'container123' })
          .mockResolvedValueOnce({ id: 'member123' })
          .mockResolvedValueOnce({ id: 'request123' })

        retrieveMock.mockResolvedValue({
          State: 'Failed',
        })

        // Act & Assert
        await expect(sut.update(mockApexClass)).rejects.toThrow(
          'Deployment failed:\nUnknown error'
        )
      })
    })

    describe('given the deployment is initially queued', () => {
      it('then should poll until completed', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }

        createMock
          .mockResolvedValueOnce({ id: 'container123' })
          .mockResolvedValueOnce({ id: 'member123' })
          .mockResolvedValueOnce({ id: 'request123' })

        retrieveMock
          .mockResolvedValueOnce({ State: 'Queued', Id: 'request123' })
          .mockResolvedValueOnce({ State: 'InProgress', Id: 'request123' })
          .mockResolvedValueOnce({ State: 'Completed', Id: 'request123' })

        // Act
        const result = await sut.update(mockApexClass)

        // Assert
        expect(result).toEqual({ State: 'Completed', Id: 'request123' })
        expect(retrieveMock).toHaveBeenCalledTimes(3)
      })
    })

    describe('given the deployment fails after being queued', () => {
      it('then should poll until failed and throw error', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }

        createMock
          .mockResolvedValueOnce({ id: 'container123' })
          .mockResolvedValueOnce({ id: 'member123' })
          .mockResolvedValueOnce({ id: 'request123' })

        retrieveMock
          .mockResolvedValueOnce({ State: 'Queued', Id: 'request123' })
          .mockResolvedValueOnce({
            State: 'Failed',
            ErrorMsg: 'Compilation error',
            DeployDetails: {
              allComponentMessages: [
                {
                  fileName: 'TestClass.cls',
                  lineNumber: 5,
                  columnNumber: 15,
                  problem: 'Invalid operator for String',
                },
              ],
            },
          })

        // Act & Assert
        await expect(sut.update(mockApexClass)).rejects.toThrow(
          'Deployment failed:\n[TestClass.cls:5:15] Invalid operator for String'
        )
        expect(retrieveMock).toHaveBeenCalledTimes(2)
      })
    })
  })
})
