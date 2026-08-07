import { Connection } from '@salesforce/core'
import { ApexTestSuiteRepository } from '../../../src/adapter/apexTestSuiteRepository.js'

describe('ApexTestSuiteRepository', () => {
  let connectionStub: Connection
  let sut: ApexTestSuiteRepository
  const autoFetchQueryMock = vi.fn()

  beforeEach(() => {
    connectionStub = {
      autoFetchQuery: autoFetchQueryMock,
    } as unknown as Connection
    sut = new ApexTestSuiteRepository(connectionStub)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('when reading test suite members', () => {
    describe('given suite names to look up', () => {
      it('then should query the exact SOQL for the requested suites', async () => {
        // Arrange
        autoFetchQueryMock.mockResolvedValue({ records: [] })

        // Act
        await sut.readMembers(['Alpha', 'Beta'])

        // Assert
        expect(autoFetchQueryMock).toHaveBeenCalledWith(
          "SELECT ApexTestSuite.TestSuiteName, ApexClass.Name FROM TestSuiteMembership WHERE ApexTestSuite.TestSuiteName IN ('Alpha', 'Beta') ORDER BY ApexClass.Name",
          { tooling: true }
        )
      })
    })

    describe('given nested membership records', () => {
      it('then should unwrap them into flat suite members', async () => {
        // Arrange
        autoFetchQueryMock.mockResolvedValue({
          records: [
            {
              ApexTestSuite: { TestSuiteName: 'Alpha' },
              ApexClass: { Name: 'AlphaTest' },
            },
          ],
        })

        // Act
        const result = await sut.readMembers(['Alpha'])

        // Assert
        expect(result).toEqual([{ suiteName: 'Alpha', className: 'AlphaTest' }])
      })
    })

    describe('given suite names containing quotes and backslashes', () => {
      it('then should escape the literals in the generated SOQL', async () => {
        // Arrange
        autoFetchQueryMock.mockResolvedValue({ records: [] })

        // Act
        await sut.readMembers(["O'Brien", 'a\\b'])

        // Assert
        expect(autoFetchQueryMock).toHaveBeenCalledWith(
          "SELECT ApexTestSuite.TestSuiteName, ApexClass.Name FROM TestSuiteMembership WHERE ApexTestSuite.TestSuiteName IN ('O\\'Brien', 'a\\\\b') ORDER BY ApexClass.Name",
          { tooling: true }
        )
      })
    })

    describe('given the query rejects', () => {
      it('then should propagate the error', async () => {
        // Arrange
        autoFetchQueryMock.mockRejectedValue(new Error('query boom'))

        // Act & Assert
        await expect(sut.readMembers(['Alpha'])).rejects.toThrow('query boom')
      })
    })
  })

  describe('when reading existing suite names', () => {
    describe('given suite names to look up', () => {
      it('then should query the exact, filtered SOQL', async () => {
        // Arrange
        autoFetchQueryMock.mockResolvedValue({ records: [] })

        // Act
        await sut.readExistingSuiteNames(['Alpha'])

        // Assert
        expect(autoFetchQueryMock).toHaveBeenCalledWith(
          "SELECT TestSuiteName FROM ApexTestSuite WHERE TestSuiteName IN ('Alpha')",
          { tooling: true }
        )
      })
    })

    describe('given matching suite records', () => {
      it('then should unwrap them into bare suite names', async () => {
        // Arrange
        autoFetchQueryMock.mockResolvedValue({
          records: [{ TestSuiteName: 'Alpha' }, { TestSuiteName: 'Beta' }],
        })

        // Act
        const result = await sut.readExistingSuiteNames(['Alpha', 'Beta'])

        // Assert
        expect(result).toEqual(['Alpha', 'Beta'])
      })
    })

    describe('given suite names containing quotes and backslashes', () => {
      it('then should escape the literals in the generated SOQL', async () => {
        // Arrange
        autoFetchQueryMock.mockResolvedValue({ records: [] })

        // Act
        await sut.readExistingSuiteNames(["O'Brien", 'a\\b'])

        // Assert
        expect(autoFetchQueryMock).toHaveBeenCalledWith(
          "SELECT TestSuiteName FROM ApexTestSuite WHERE TestSuiteName IN ('O\\'Brien', 'a\\\\b')",
          { tooling: true }
        )
      })
    })

    describe('given the query rejects', () => {
      it('then should propagate the error', async () => {
        // Arrange
        autoFetchQueryMock.mockRejectedValue(new Error('query boom'))

        // Act & Assert
        await expect(sut.readExistingSuiteNames(['Alpha'])).rejects.toThrow(
          'query boom'
        )
      })
    })
  })
})
