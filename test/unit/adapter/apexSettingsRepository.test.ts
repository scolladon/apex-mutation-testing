import { Connection } from '@salesforce/core'
import { ApexSettingsRepository } from '../../../src/adapter/apexSettingsRepository.js'

describe('ApexSettingsRepository', () => {
  let connectionStub: Connection
  let sut: ApexSettingsRepository
  const queryMock = vi.fn()

  beforeEach(() => {
    connectionStub = {
      tooling: {
        query: queryMock,
      },
    } as unknown as Connection
    sut = new ApexSettingsRepository(connectionStub)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('when reading the aggregate-coverage-only setting', () => {
    describe('given the org has aggregate coverage enabled', () => {
      it('then should resolve true', async () => {
        // Arrange
        queryMock.mockResolvedValue({
          records: [{ IsAggregateCodeCoverageOnlyEnabled: true }],
        })

        // Act
        const result = await sut.isAggregateCoverageOnly()

        // Assert
        expect(result).toBe(true)
        expect(queryMock).toHaveBeenCalledWith(
          'SELECT IsAggregateCodeCoverageOnlyEnabled FROM ApexSettings'
        )
      })
    })

    describe('given the org has aggregate coverage disabled', () => {
      it('then should resolve false', async () => {
        // Arrange
        queryMock.mockResolvedValue({
          records: [{ IsAggregateCodeCoverageOnlyEnabled: false }],
        })

        // Act
        const result = await sut.isAggregateCoverageOnly()

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('given the query returns no records', () => {
      it('then should resolve false', async () => {
        // Arrange
        queryMock.mockResolvedValue({ records: [] })

        // Act
        const result = await sut.isAggregateCoverageOnly()

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('given the query rejects', () => {
      it('then should propagate the error', async () => {
        // Arrange
        queryMock.mockRejectedValue(new Error('query boom'))

        // Act & Assert
        await expect(sut.isAggregateCoverageOnly()).rejects.toThrow(
          'query boom'
        )
      })
    })
  })
})
