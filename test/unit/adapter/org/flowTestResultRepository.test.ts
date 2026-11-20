import type { Connection } from '@salesforce/core'
import {
  FlowTestResultRepository,
  versionsRunBetween,
} from '../../../../src/adapter/org/flowTestResultRepository.js'

describe('FlowTestResultRepository', () => {
  describe('listResults', () => {
    it('Given stored results, When listed, Then they are read by the definition Id in both forms and mapped', async () => {
      // Arrange
      const autoFetchQuery = vi.fn().mockResolvedValue({
        records: [
          {
            Id: '2hU1',
            FlowVersionNumber: '6',
            SystemModstamp: '2026-11-13T00:44:00.000+0000',
          },
        ],
      })
      const sut = new FlowTestResultRepository({
        autoFetchQuery,
      } as unknown as Connection)

      // Act
      const result = await sut.listResults('3009b00000msQBaAAM')

      // Assert
      expect(result).toEqual([
        {
          id: '2hU1',
          versionNumber: 6,
          modstamp: '2026-11-13T00:44:00.000+0000',
        },
      ])
      expect(autoFetchQuery).toHaveBeenCalledWith(
        "SELECT Id, FlowVersionNumber, SystemModstamp FROM FlowTestResult WHERE FlowDefinitionViewId IN ('3009b00000msQBa', '3009b00000msQBaAAM')"
      )
    })
  })

  describe('versionsRunBetween', () => {
    const row = (id: string, versionNumber: number, modstamp: string) => ({
      id,
      versionNumber,
      modstamp,
    })

    it('Given new rows and rewritten rows, When compared, Then the versions of exactly those are returned', () => {
      // Arrange
      const before = [row('a', 1, 't1'), row('b', 2, 't1')]
      const after = [row('a', 1, 't1'), row('b', 2, 't2'), row('c', 3, 't2')]

      // Act & Assert
      expect(versionsRunBetween(before, after)).toEqual([2, 3])
    })

    it('Given nothing changed, When compared, Then no version is returned', () => {
      // Arrange
      const rows = [row('a', 1, 't1')]

      // Act & Assert
      expect(versionsRunBetween(rows, rows)).toEqual([])
    })
  })
})
