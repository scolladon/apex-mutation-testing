import { Connection } from '@salesforce/core'
import { EntityDefinitionRepository } from '../../../../src/adapter/org/entityDefinitionRepository.js'

describe('EntityDefinitionRepository', () => {
  let connectionStub: Connection
  let sut: EntityDefinitionRepository
  const sobjectMock = vi.fn()
  const findArgsMock = vi.fn()
  const executeMock = vi.fn()

  beforeEach(() => {
    connectionStub = {
      tooling: {
        sobject: (objectType: string) => {
          sobjectMock(objectType)
          return {
            find: (...args: unknown[]) => {
              findArgsMock(...args)
              return { execute: executeMock }
            },
          }
        },
      },
    } as unknown as Connection
    sut = new EntityDefinitionRepository(connectionStub)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('when reading by developer names', () => {
    it('Given two developer names, When reading by developer names, Then one find is issued against EntityDefinition with a DeveloperName $in filter and the three-field projection', async () => {
      // Arrange
      const rows = [
        {
          DeveloperName: 'ProbeObj',
          QualifiedApiName: 'ProbeObj__c',
          NamespacePrefix: null,
        },
        {
          DeveloperName: 'Invoice',
          QualifiedApiName: 'ns__Invoice__c',
          NamespacePrefix: 'ns',
        },
      ]
      executeMock.mockResolvedValueOnce(rows)

      // Act
      const result = await sut.readByDeveloperNames(['ProbeObj', 'Invoice'])

      // Assert
      expect(sobjectMock).toHaveBeenCalledWith('EntityDefinition')
      expect(findArgsMock).toHaveBeenCalledWith(
        { DeveloperName: { $in: ['ProbeObj', 'Invoice'] } },
        ['DeveloperName', 'QualifiedApiName', 'NamespacePrefix']
      )
      expect(result).toEqual(rows)
    })

    describe('given no developer names', () => {
      it('Given no developer names, When reading by developer names, Then it resolves empty and issues no find', async () => {
        // Act
        const result = await sut.readByDeveloperNames([])

        // Assert
        expect(result).toEqual([])
        expect(findArgsMock).not.toHaveBeenCalled()
      })
    })

    describe('given the sink is invoked directly with no names', () => {
      it('Given the sink is invoked directly with no names, When it runs, Then it resolves empty without building an unfiltered $in query', async () => {
        // Arrange — chunk([]) already yields zero chunks, so
        // readByDeveloperNames([]) never reaches this private sink through the
        // public API. This exercises the guard directly since it exists as
        // defense-in-depth against a future change to chunk's emptiness
        // semantics, and against jsforce dropping the whole WHERE clause for
        // an empty $in (which would turn this into an unfiltered org-wide
        // read that EntityDefinition cannot page through — see queryMore).
        const queryByDeveloperNames = (
          sut as unknown as {
            queryByDeveloperNames(names: string[]): Promise<unknown[]>
          }
        ).queryByDeveloperNames.bind(sut)

        // Act
        const result = await queryByDeveloperNames([])

        // Assert
        expect(result).toEqual([])
        expect(findArgsMock).not.toHaveBeenCalled()
      })
    })

    describe('given a perimeter one name larger than the chunk size', () => {
      it('Given one name more than the chunk size, When reading, Then two finds are issued, 200 then 1, and the rows are returned in chunk order', async () => {
        // Arrange
        const firstChunkNames = Array.from(
          { length: 200 },
          (_, i) => `Name${i}`
        )
        const names = [...firstChunkNames, 'Overflow']
        const firstRows = [
          {
            DeveloperName: 'Name0',
            QualifiedApiName: 'Name0__c',
            NamespacePrefix: null,
          },
        ]
        const secondRows = [
          {
            DeveloperName: 'Overflow',
            QualifiedApiName: 'Overflow__c',
            NamespacePrefix: null,
          },
        ]
        executeMock
          .mockResolvedValueOnce(firstRows)
          .mockResolvedValueOnce(secondRows)

        // Act
        const result = await sut.readByDeveloperNames(names)

        // Assert
        expect(result).toEqual([...firstRows, ...secondRows])
        expect(findArgsMock).toHaveBeenCalledTimes(2)
        expect(findArgsMock.mock.calls[0][0]).toEqual({
          DeveloperName: { $in: firstChunkNames },
        })
        expect(findArgsMock.mock.calls[1][0]).toEqual({
          DeveloperName: { $in: ['Overflow'] },
        })
      })
    })

    describe('given a perimeter exactly the chunk size', () => {
      it('Given exactly the chunk size, When reading, Then exactly one find is issued', async () => {
        // Arrange
        const names = Array.from({ length: 200 }, (_, i) => `Name${i}`)
        executeMock.mockResolvedValueOnce([])

        // Act
        await sut.readByDeveloperNames(names)

        // Assert
        expect(findArgsMock).toHaveBeenCalledTimes(1)
      })
    })
  })
})
