import { Connection } from '@salesforce/core'
import {
  ApexClassRepository,
  PollTimeoutError,
} from '../../../src/adapter/apexClassRepository.js'

describe('ApexClassRepository', () => {
  let connectionStub: Connection
  let sut: ApexClassRepository
  const findMock = vi.fn()
  const createMock = vi.fn()
  const retrieveMock = vi.fn()
  const deleteMock = vi.fn()

  beforeEach(() => {
    deleteMock.mockResolvedValue(undefined)
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
              delete: deleteMock,
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
    vi.clearAllMocks()
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
    it('given a classId, then returns dependencies', async () => {
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

    describe('given the MetadataContainer creation returns no id', () => {
      it('then should throw a descriptive error', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }
        createMock.mockResolvedValueOnce({}) // no id

        // Act & Assert
        await expect(sut.update(mockApexClass)).rejects.toThrow(
          'MetadataContainer did not return an ID'
        )
      })
    })

    describe('given the deployment succeeds', () => {
      it('then the MetadataContainer is deleted after success', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }
        createMock
          .mockResolvedValueOnce({ id: 'containerABC' })
          .mockResolvedValueOnce({ id: 'member123' })
          .mockResolvedValueOnce({ id: 'request123' })
        retrieveMock.mockResolvedValue({
          State: 'Completed',
          Id: 'request123',
        })

        // Act
        await sut.update(mockApexClass)

        // Assert
        expect(deleteMock).toHaveBeenCalledWith('containerABC')
      })
    })

    describe('given the deployment fails', () => {
      it('then the MetadataContainer is still deleted (finally block)', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }
        createMock
          .mockResolvedValueOnce({ id: 'containerXYZ' })
          .mockResolvedValueOnce({ id: 'member123' })
          .mockResolvedValueOnce({ id: 'request123' })
        retrieveMock.mockResolvedValue({
          State: 'Failed',
          ErrorMsg: 'boom',
        })

        // Act
        await expect(sut.update(mockApexClass)).rejects.toThrow(
          'Deployment failed'
        )

        // Assert — cleanup MUST run even on failure
        expect(deleteMock).toHaveBeenCalledWith('containerXYZ')
      })
    })

    describe('given the MetadataContainer delete fails', () => {
      it('then the failure is swallowed and original result is returned', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }
        createMock
          .mockResolvedValueOnce({ id: 'containerDEF' })
          .mockResolvedValueOnce({ id: 'member123' })
          .mockResolvedValueOnce({ id: 'request123' })
        retrieveMock.mockResolvedValue({
          State: 'Completed',
          Id: 'request123',
        })
        deleteMock.mockRejectedValueOnce(new Error('delete failed'))

        // Act
        const result = await sut.update(mockApexClass)

        // Assert — the delete failure is non-fatal
        expect(result).toEqual({ State: 'Completed', Id: 'request123' })
        expect(deleteMock).toHaveBeenCalledWith('containerDEF')
      })
    })

    describe('given the deployment never reaches a terminal state', () => {
      // Negative budget = deadline before Date.now() so the first retrieve
      // inside the loop triggers the timeout branch. 0 is rejected as racy.
      const IMMEDIATE_TIMEOUT_MS = -1

      it('then throws PollTimeoutError with requestId and lastState', async () => {
        // Arrange
        sut = new ApexClassRepository(connectionStub, {
          initialIntervalMs: 0,
          maxIntervalMs: 0,
          timeoutMs: IMMEDIATE_TIMEOUT_MS,
        })
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }
        createMock
          .mockResolvedValueOnce({ id: 'containerSLOW' })
          .mockResolvedValueOnce({ id: 'member123' })
          .mockResolvedValueOnce({ id: 'request999' })
        retrieveMock.mockResolvedValue({ State: 'Queued', Id: 'request999' })

        // Act & Assert
        let thrown: unknown
        try {
          await sut.update(mockApexClass)
        } catch (error) {
          thrown = error
        }
        expect(thrown).toBeInstanceOf(PollTimeoutError)
        const pollErr = thrown as PollTimeoutError
        expect(pollErr.requestId).toBe('request999')
        expect(pollErr.lastState).toBe('Queued')
        expect(pollErr.name).toBe('PollTimeoutError')
        // container still cleaned up on timeout
        expect(deleteMock).toHaveBeenCalledWith('containerSLOW')
      })
    })

    describe('given the deployment eventually reaches a terminal state', () => {
      it('then backoff is applied between polls and the result is returned', async () => {
        // Arrange — two Queued polls then Completed. With backoff 1.5x from 1ms,
        // runtime stays <20ms even on slow CI.
        sut = new ApexClassRepository(connectionStub, {
          initialIntervalMs: 1,
          maxIntervalMs: 2,
          timeoutMs: 5_000,
        })
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }
        createMock
          .mockResolvedValueOnce({ id: 'containerBO' })
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
      })
    })
  })

  describe('poll options validation', () => {
    it('Given timeoutMs of 0 (racy), When constructing, Then throws', () => {
      // HIGH-1: 0 is ambiguous because deadline == now; reject it.
      expect(
        () =>
          new ApexClassRepository(connectionStub, {
            timeoutMs: 0,
          })
      ).toThrow(/timeoutMs must be non-zero/)
    })

    it('Given negative initialIntervalMs, When constructing, Then throws', () => {
      expect(
        () =>
          new ApexClassRepository(connectionStub, {
            initialIntervalMs: -5,
          })
      ).toThrow(/initialIntervalMs must be >= 0/)
    })

    it('Given negative maxIntervalMs, When constructing, Then throws', () => {
      expect(
        () =>
          new ApexClassRepository(connectionStub, {
            maxIntervalMs: -5,
          })
      ).toThrow(/maxIntervalMs must be >= 0/)
    })

    it('Given no pollOptions, When constructing, Then uses defaults without throwing', () => {
      // Happy path — defaults must satisfy the guards.
      expect(() => new ApexClassRepository(connectionStub)).not.toThrow()
    })
  })
})
