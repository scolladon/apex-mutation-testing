import type { Connection } from '@salesforce/core'
import { FlowVersionRepository } from '../../../../src/adapter/org/flowVersionRepository.js'
import {
  FlowAmbiguousError,
  FlowDeployFailedError,
  FlowNotFoundError,
} from '../../../../src/port/flowErrors.js'

describe('FlowVersionRepository', () => {
  const query = vi.fn()
  const remove = vi.fn()
  const update = vi.fn()
  const sobject = vi.fn().mockReturnValue({ delete: remove, update })
  const connection = {
    tooling: { query, sobject },
  } as unknown as Connection
  const sut = new FlowVersionRepository(connection)

  describe('readDefinitionId', () => {
    it('Given one definition, When read, Then its Id is returned from an escaped Tooling query', async () => {
      // Arrange
      query.mockResolvedValue({ records: [{ Id: '300A' }] })

      // Act
      const result = await sut.readDefinitionId("Bad'Name")

      // Assert
      expect(result).toBe('300A')
      expect(query).toHaveBeenCalledWith(
        "SELECT Id FROM FlowDefinition WHERE DeveloperName = 'Bad\\'Name'"
      )
    })

    it('Given no definition, When read, Then it throws FlowNotFoundError', async () => {
      // Arrange
      query.mockResolvedValue({ records: [] })

      // Act & Assert
      await expect(sut.readDefinitionId('X')).rejects.toEqual(
        new FlowNotFoundError('X')
      )
    })

    it('Given several definitions, When read, Then it throws FlowAmbiguousError', async () => {
      // Arrange
      query.mockResolvedValue({ records: [{ Id: '1' }, { Id: '2' }] })

      // Act & Assert
      await expect(sut.readDefinitionId('X')).rejects.toEqual(
        new FlowAmbiguousError('X', 2)
      )
    })
  })

  describe('listVersions', () => {
    it('Given versions, When listed, Then they are mapped in version order', async () => {
      // Arrange
      query.mockResolvedValue({
        records: [
          { Id: '3011', VersionNumber: 1, Status: 'Obsolete' },
          { Id: '3012', VersionNumber: '2', Status: 'Active' },
        ],
      })

      // Act
      const result = await sut.listVersions('300A')

      // Assert
      expect(result).toEqual([
        { id: '3011', versionNumber: 1, status: 'Obsolete' },
        { id: '3012', versionNumber: 2, status: 'Active' },
      ])
      expect(query).toHaveBeenCalledWith(
        "SELECT Id, VersionNumber, Status FROM Flow WHERE DefinitionId = '300A' ORDER BY VersionNumber"
      )
    })
  })

  describe('activateVersion', () => {
    it('Given an accepted activation, When activating, Then the FlowDefinition metadata names the version', async () => {
      // Arrange
      update.mockResolvedValue({ success: true, errors: [] })

      // Act
      await sut.activateVersion('300A', 6)

      // Assert
      expect(sobject).toHaveBeenCalledWith('FlowDefinition')
      expect(update).toHaveBeenCalledWith({
        Id: '300A',
        Metadata: { activeVersionNumber: 6 },
      })
    })

    it('Given a refused activation, When activating, Then it throws a deploy failure with the reasons', async () => {
      // Arrange
      update.mockResolvedValue({
        success: false,
        errors: [{ message: 'flow has errors' }, 'locked'],
      })

      // Act & Assert
      await expect(sut.activateVersion('300A', 6)).rejects.toEqual(
        new FlowDeployFailedError(['flow has errors', 'locked'])
      )
    })
  })

  describe('deleteVersion', () => {
    it('Given a successful delete, When deleting, Then the Tooling Flow record is deleted by Id', async () => {
      // Arrange
      remove.mockResolvedValue({ success: true, errors: [] })

      // Act
      await sut.deleteVersion({ id: '3012', versionNumber: 2, status: 'Draft' })

      // Assert
      expect(sobject).toHaveBeenCalledWith('Flow')
      expect(remove).toHaveBeenCalledWith('3012')
    })

    it('Given a refused delete, When deleting, Then it throws with the reasons', async () => {
      // Arrange
      remove.mockResolvedValue({
        success: false,
        errors: [{ message: 'has paused interviews' }, 'locked'],
      })

      // Act & Assert
      await expect(
        sut.deleteVersion({ id: '3012', versionNumber: 2, status: 'Draft' })
      ).rejects.toThrow(
        'Could not delete version 2: has paused interviews; locked'
      )
    })
  })
})
