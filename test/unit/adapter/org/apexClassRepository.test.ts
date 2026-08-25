import { Connection } from '@salesforce/core'
import {
  ApexClassRepository,
  DeploymentFailedError,
  PollTimeoutError,
} from '../../../../src/adapter/org/apexClassRepository.js'
import { SKIP_TESTS } from '../../../../src/port/mutationTestBed.js'

describe('ApexClassRepository', () => {
  let connectionStub: Connection
  let sut: ApexClassRepository
  const findMock = vi.fn()
  const createMock = vi.fn()
  const retrieveMock = vi.fn()
  const deleteMock = vi.fn()
  // All four sObject types share one createMock, so the call payloads alone
  // cannot say which type each create hit. Recording the type makes the
  // container/member/request sequence assertable.
  const sobjectMock = vi.fn()
  // `find` args carry the ApexClass lookup filter; recording them makes the
  // Name/NamespacePrefix payload assertable.
  const findArgsMock = vi.fn()

  beforeEach(() => {
    deleteMock.mockResolvedValue(undefined)
    connectionStub = {
      tooling: {
        sobject: (objectType: string) => {
          sobjectMock(objectType)
          return buildSObjectStub(objectType)
        },
      },
    } as unknown as Connection
    sut = new ApexClassRepository(connectionStub)

    function buildSObjectStub(objectType: string) {
      if (objectType === 'ApexClass') {
        return {
          find: (...args: unknown[]) => {
            findArgsMock(...args)
            return { execute: findMock }
          },
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
        find: (...args: unknown[]) => {
          findArgsMock(...args)
          return { execute: findMock }
        },
        create: createMock,
        retrieve: retrieveMock,
      }
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('when reading ApexClass candidates', () => {
    it('then issues one find call with only the Name filter and the NamespacePrefix/ManageableState projection', async () => {
      // Arrange
      const rows = [
        { NamespacePrefix: 'namespaced', ManageableState: 'deprecated' },
      ]
      findMock.mockResolvedValueOnce(rows)

      // Act
      const result = await sut.readCandidates('Mutation')

      // Assert
      expect(result).toEqual(rows)
      expect(sobjectMock).toHaveBeenCalledWith('ApexClass')
      expect(findArgsMock).toHaveBeenCalledTimes(1)
      const [conditions, fields] = findArgsMock.mock.calls[0]
      // Namespace and manageable state are classified in memory, never
      // filtered on here: either predicate would collapse a managed class
      // and a genuinely absent class into the same zero-row result, which
      // is the exact defect a discriminated verdict exists to fix.
      expect(conditions).toEqual({ Name: 'Mutation' })
      expect(conditions).not.toHaveProperty('NamespacePrefix')
      expect(fields).toEqual(['NamespacePrefix', 'ManageableState'])
    })

    it.each(["Mutation' OR Name != '", 'Mutation\\'])(
      'Given a name carrying a quote or backslash (%j), When reading ApexClass candidates, Then it refuses to build the predicate',
      async hostileName => {
        // Arrange — jsforce's literal builder escapes quotes but leaves
        // backslashes raw, so a name it accepts can still close its own
        // literal and run on into the WHERE clause. ConfigReader rejects
        // both characters upstream; this asserts the sink no longer depends
        // on that being true.

        // Act
        const act = sut.readCandidates(hostileName)

        // Assert
        await expect(act).rejects.toBeInstanceOf(Error)
        await expect(act).rejects.toThrow(/does not escape it/)
        expect(findArgsMock).not.toHaveBeenCalled()
      }
    )

    it.each([undefined, ''])(
      'Given a falsy name (%j), When reading ApexClass candidates, Then it resolves empty without issuing an unfiltered find',
      async falsyName => {
        // Arrange — jsforce drops a predicate whose value is undefined,
        // which would otherwise turn this into an unfiltered org-wide
        // ApexClass read.

        // Act
        const result = await sut.readCandidates(falsyName as unknown as string)

        // Assert
        expect(result).toEqual([])
        expect(findArgsMock).not.toHaveBeenCalled()
      }
    )
  })

  describe('when reading ApexClass body candidates', () => {
    it('then issues one find call with only the Name filter and the Id/Body/NamespacePrefix/ManageableState projection', async () => {
      // Arrange
      const rows = [
        {
          Id: '123',
          Body: 'class Mutation {}',
          NamespacePrefix: 'namespaced',
          ManageableState: 'deprecated',
        },
      ]
      findMock.mockResolvedValueOnce(rows)

      // Act
      const result = await sut.readBodyCandidates('Mutation')

      // Assert
      expect(result).toEqual(rows)
      expect(sobjectMock).toHaveBeenCalledWith('ApexClass')
      expect(findArgsMock).toHaveBeenCalledTimes(1)
      const [conditions, fields] = findArgsMock.mock.calls[0]
      expect(conditions).toEqual({ Name: 'Mutation' })
      expect(conditions).not.toHaveProperty('NamespacePrefix')
      expect(fields).toEqual([
        'Id',
        'Body',
        'NamespacePrefix',
        'ManageableState',
      ])
    })

    it.each([undefined, ''])(
      'Given a falsy name (%j), When reading ApexClass body candidates, Then it resolves empty without issuing an unfiltered find',
      async falsyName => {
        // Arrange — jsforce drops a predicate whose value is undefined,
        // which would otherwise turn this into an unfiltered org-wide
        // ApexClass read that could hand back an arbitrary class body.

        // Act
        const result = await sut.readBodyCandidates(
          falsyName as unknown as string
        )

        // Assert
        expect(result).toEqual([])
        expect(findArgsMock).not.toHaveBeenCalled()
      }
    )
  })

  describe('when reading ApexClass identities', () => {
    describe('given a perimeter within the chunk limit', () => {
      it('then issues one find call with an $in filter, no namespace pin, and the Id/Name/NamespacePrefix/ManageableState projection', async () => {
        // Arrange
        const rows = [
          { Name: 'A', NamespacePrefix: null },
          { Name: 'B', NamespacePrefix: 'et4ae5' },
        ]
        findMock.mockResolvedValueOnce(rows)

        // Act
        const result = await sut.readIdentities(['A', 'B'])

        // Assert
        expect(result).toEqual(rows)
        expect(findArgsMock).toHaveBeenCalledTimes(1)
        const [conditions, fields] = findArgsMock.mock.calls[0]
        expect(conditions).toEqual({ Name: { $in: ['A', 'B'] } })
        // A namespace pin here would re-hide every namespaced class behind
        // an indistinguishable empty result, the same trap `read` avoids by
        // pinning it deliberately.
        expect(conditions).not.toHaveProperty('NamespacePrefix')
        // ManageableState is projected, never filtered on: a server-side
        // predicate would make a managed class and a nonexistent class both
        // come back as zero rows, destroying the not-found/not-accessible
        // distinction this query exists to preserve.
        expect(fields).toEqual([
          'Id',
          'Name',
          'NamespacePrefix',
          'ManageableState',
        ])
      })
    })

    describe('given a perimeter mixing qualified and duplicate bare spellings', () => {
      it('then bare-ifies each spelling and dedupes before building the $in filter', async () => {
        // Arrange
        findMock.mockResolvedValueOnce([])

        // Act
        await sut.readIdentities(['Foo', 'mockery.Foo', 'foo'])

        // Assert — 'mockery.Foo' bare-ifies to 'Foo', already present, so it
        // dedupes away; 'foo' stays distinct under case-sensitive Set
        // semantics.
        expect(findArgsMock).toHaveBeenCalledTimes(1)
        const [conditions] = findArgsMock.mock.calls[0]
        expect(conditions).toEqual({ Name: { $in: ['Foo', 'foo'] } })
      })
    })

    describe('given a perimeter one name larger than the chunk size', () => {
      it('then issues two find calls, one per chunk, and returns the union in chunk order', async () => {
        // Arrange
        const firstChunkNames = Array.from(
          { length: 200 },
          (_, i) => `Name${i}`
        )
        const names = [...firstChunkNames, 'Overflow']
        const firstChunkRows = [{ Name: 'Name0', NamespacePrefix: null }]
        const secondChunkRows = [{ Name: 'Overflow', NamespacePrefix: null }]
        findMock
          .mockResolvedValueOnce(firstChunkRows)
          .mockResolvedValueOnce(secondChunkRows)

        // Act
        const result = await sut.readIdentities(names)

        // Assert
        expect(result).toEqual([...firstChunkRows, ...secondChunkRows])
        expect(findArgsMock).toHaveBeenCalledTimes(2)
        expect(findArgsMock.mock.calls[0][0]).toEqual({
          Name: { $in: firstChunkNames },
        })
        expect(findArgsMock.mock.calls[1][0]).toEqual({
          Name: { $in: ['Overflow'] },
        })
      })
    })

    describe('given a perimeter exactly the chunk size', () => {
      it('then issues exactly one find call', async () => {
        // Arrange
        const names = Array.from({ length: 200 }, (_, i) => `Name${i}`)
        findMock.mockResolvedValueOnce([])

        // Act
        await sut.readIdentities(names)

        // Assert
        expect(findArgsMock).toHaveBeenCalledTimes(1)
      })
    })

    describe('given an empty perimeter', () => {
      it('then resolves with an empty array and issues no find call', async () => {
        // Act
        const result = await sut.readIdentities([])

        // Assert
        expect(result).toEqual([])
        expect(findArgsMock).not.toHaveBeenCalled()
      })
    })

    describe('given the sink is invoked directly with no names', () => {
      it('then it resolves with an empty array without building an unfiltered $in query', async () => {
        // Arrange — chunk([]) already yields zero chunks, so readIdentities([])
        // never reaches this private sink through the public API. This exercises
        // the guard directly since it exists as defense-in-depth against a
        // future change to chunk's emptiness semantics.
        const queryIdentities = (
          sut as unknown as {
            queryIdentities(names: string[]): Promise<unknown[]>
          }
        ).queryIdentities.bind(sut)

        // Act
        const result = await queryIdentities([])

        // Assert
        expect(result).toEqual([])
        expect(findArgsMock).not.toHaveBeenCalled()
      })
    })

    describe('given a perimeter large enough to produce more chunks than the concurrency cap', () => {
      it('then never issues more than 25 concurrent find calls', async () => {
        // Arrange — 30 chunks (6000 names) against a cap of 25 concurrent queries
        const names = Array.from({ length: 30 * 200 }, (_, i) => `Name${i}`)
        let inFlight = 0
        let maxInFlight = 0
        findMock.mockImplementation(async () => {
          inFlight++
          maxInFlight = Math.max(maxInFlight, inFlight)
          await Promise.resolve()
          inFlight--
          return []
        })

        // Act
        await sut.readIdentities(names)

        // Assert
        expect(findArgsMock).toHaveBeenCalledTimes(30)
        expect(maxInFlight).toBeLessThanOrEqual(25)
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

    it('given a classId, When getting dependencies, Then the read projects Id, type, name and namespace explicitly', async () => {
      // Arrange
      findMock.mockResolvedValue([])

      // Act
      await sut.getApexClassDependencies('123')

      // Assert
      expect(findArgsMock).toHaveBeenCalledWith(
        { MetadataComponentId: '123' },
        [
          'Id',
          'RefMetadataComponentType',
          'RefMetadataComponentName',
          'RefMetadataComponentNamespace',
        ]
      )
    })

    it('Given an undefined classId, When getting dependencies, Then it resolves empty without issuing an unfiltered find', async () => {
      // Arrange — jsforce drops a predicate whose value is undefined, which
      // would otherwise turn this into an unfiltered org-wide
      // MetadataComponentDependency read.

      // Act
      const result = await sut.getApexClassDependencies(
        undefined as unknown as string
      )

      // Assert
      expect(result).toEqual([])
      expect(findArgsMock).not.toHaveBeenCalled()
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
        // The container/member/request sequence must hit the right sObject
        // type at each step — the shared createMock alone cannot tell them
        // apart, only the recorded sobject() argument can.
        expect(sobjectMock).toHaveBeenNthCalledWith(1, 'MetadataContainer')
        expect(sobjectMock).toHaveBeenNthCalledWith(2, 'ApexClassMember')
        expect(sobjectMock).toHaveBeenNthCalledWith(3, 'ContainerAsyncRequest')
        // The member payload must link the container, the class and its body.
        expect(createMock).toHaveBeenNthCalledWith(2, {
          MetadataContainerId: 'container123',
          ContentEntityId: '123',
          Body: 'public class TestClass {}',
        })
        // IsCheckOnly must stay false — true would validate-only and never
        // actually deploy the mutated body.
        expect(createMock).toHaveBeenNthCalledWith(3, {
          IsCheckOnly: false,
          MetadataContainerId: 'container123',
          IsRunTests: true,
        })
      })
    })

    describe('given the caller asks to skip the tests', () => {
      it('then should deploy without running them', async () => {
        // Arrange — restoring the original body needs no coverage, and on a
        // quota-exhausted org a test-running deploy is the request most likely
        // to be refused.
        const mockApexClass = {
          Id: '123',
          Body: 'public class TestClass {}',
        }

        createMock
          .mockResolvedValueOnce({ id: 'container123' })
          .mockResolvedValueOnce({ id: 'member123' })
          .mockResolvedValueOnce({ id: 'request123' })

        retrieveMock.mockResolvedValue({
          State: 'Completed',
          Id: 'request123',
        })

        // Act
        await sut.update(mockApexClass, SKIP_TESTS)

        // Assert
        expect(createMock).toHaveBeenNthCalledWith(3, {
          IsCheckOnly: false,
          MetadataContainerId: 'container123',
          IsRunTests: false,
        })
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

      it('then throws a DeploymentFailedError whose message still starts with "Deployment failed:"', async () => {
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

        // Act
        let thrown: unknown
        try {
          await sut.update(mockApexClass)
        } catch (error) {
          thrown = error
        }

        // Assert
        expect(thrown).toBeInstanceOf(DeploymentFailedError)
        expect((thrown as Error).message).toMatch(/^Deployment failed:/)
        // oclif prints an uncaught error's `name`, so it is externally
        // observable — not just an internal implementation detail.
        expect((thrown as Error).name).toBe('DeploymentFailedError')
      })
    })

    describe('given the deployment fails with multiple component messages', () => {
      it('then should join them with a newline separator', async () => {
        // Arrange — a single message cannot distinguish a newline separator
        // from an empty one; two messages can.
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
              {
                fileName: 'TestClass.cls',
                lineNumber: 5,
                columnNumber: 3,
                problem: 'Unexpected token',
              },
            ],
          },
        })

        // Act & Assert
        await expect(sut.update(mockApexClass)).rejects.toThrow(
          'Deployment failed:\n[TestClass.cls:1:10] Missing semicolon\n[TestClass.cls:5:3] Unexpected token'
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
        expect(pollErr.message).toContain('request999')
        expect(pollErr.message).toContain('Queued')
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

      it('then each wait follows the exponential backoff capped at maxIntervalMs', async () => {
        // Arrange — initial 50ms, cap 60ms, factor 1.5. The cap has to bind on
        // the very first step (75 > 60) so that capping, growing and defaulting
        // all produce different sequences:
        //   expected      50, 60, 60
        //   Math.max      50, 75, 112   (grows past the cap)
        //   `*` -> `/`    50, 33, 22    (decays instead of growing)
        //   initial `??` -> `&&`  100, 60, 60   (falls back to the default)
        //   max `??` -> `&&`      50, 75, 112   (cap becomes the 2000ms default)
        // Neither configured value equals its default, so the fallbacks show up.
        const waits: number[] = []
        const timeoutSpy = vi
          .spyOn(globalThis, 'setTimeout')
          .mockImplementation(((callback: () => void, ms?: number) => {
            waits.push(ms as number)
            callback()
            return 0
          }) as never)
        sut = new ApexClassRepository(connectionStub, {
          initialIntervalMs: 50,
          maxIntervalMs: 60,
          timeoutMs: 5_000,
        })
        createMock
          .mockResolvedValueOnce({ id: 'containerBK' })
          .mockResolvedValueOnce({ id: 'member123' })
          .mockResolvedValueOnce({ id: 'request123' })
        retrieveMock
          .mockResolvedValueOnce({ State: 'Queued', Id: 'request123' })
          .mockResolvedValueOnce({ State: 'Queued', Id: 'request123' })
          .mockResolvedValueOnce({ State: 'InProgress', Id: 'request123' })
          .mockResolvedValueOnce({ State: 'Completed', Id: 'request123' })

        // Act
        const result = await sut.update({
          Id: '123',
          Body: 'public class TestClass {}',
        })

        // Assert
        expect(result).toEqual({ State: 'Completed', Id: 'request123' })
        expect(waits).toEqual([50, 60, 60])
        // One create + one pre-loop retrieve + three in-loop retrieves.
        expect(
          sobjectMock.mock.calls.filter(
            ([type]) => type === 'ContainerAsyncRequest'
          )
        ).toHaveLength(5)
        timeoutSpy.mockRestore()
      })

      it('then a poll landing exactly on the deadline is still allowed to continue', async () => {
        // Arrange — Date.now() is read once for the container name, once to
        // compute the deadline, then once per loop pass. Returning exactly the
        // deadline on that check pins `>` against `>=`: the budget is not spent
        // until the deadline is passed.
        const timeoutMs = 100
        const nowValues = [1_000, 1_000, 1_100]
        let nowIndex = 0
        const nowSpy = vi
          .spyOn(Date, 'now')
          .mockImplementation(() => nowValues[Math.min(nowIndex++, 2)])
        const timeoutSpy = vi
          .spyOn(globalThis, 'setTimeout')
          .mockImplementation(((callback: () => void) => {
            callback()
            return 0
          }) as never)
        sut = new ApexClassRepository(connectionStub, {
          initialIntervalMs: 1,
          maxIntervalMs: 1,
          timeoutMs,
        })
        createMock
          .mockResolvedValueOnce({ id: 'containerDL' })
          .mockResolvedValueOnce({ id: 'member123' })
          .mockResolvedValueOnce({ id: 'request123' })
        retrieveMock
          .mockResolvedValueOnce({ State: 'Queued', Id: 'request123' })
          .mockResolvedValueOnce({ State: 'Completed', Id: 'request123' })

        // Act
        const result = await sut.update({
          Id: '123',
          Body: 'public class TestClass {}',
        })

        // Assert — reaching the deadline exactly must not abort the poll
        expect(result).toEqual({ State: 'Completed', Id: 'request123' })
        nowSpy.mockRestore()
        timeoutSpy.mockRestore()
      })

      it('then the MetadataContainer is named with a MutationTest timestamp', async () => {
        // Arrange
        createMock
          .mockResolvedValueOnce({ id: 'containerNM' })
          .mockResolvedValueOnce({ id: 'member123' })
          .mockResolvedValueOnce({ id: 'request123' })
        retrieveMock.mockResolvedValue({
          State: 'Completed',
          Id: 'request123',
        })

        // Act
        await sut.update({ Id: '123', Body: 'public class TestClass {}' })

        // Assert — the container name must stay unique per run
        expect(createMock).toHaveBeenNthCalledWith(1, {
          Name: expect.stringMatching(/^MutationTest_\d+$/),
        })
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
