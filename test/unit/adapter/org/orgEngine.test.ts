import type { Connection } from '@salesforce/core'
import { ApexClassRepository } from '../../../../src/adapter/org/apexClassRepository.js'
import { ApexSettingsRepository } from '../../../../src/adapter/org/apexSettingsRepository.js'
import { ApexTestRunner } from '../../../../src/adapter/org/apexTestRunner.js'
import { ApexTestSuiteRepository } from '../../../../src/adapter/org/apexTestSuiteRepository.js'
import { OrgApexSourceProvider } from '../../../../src/adapter/org/orgApexSourceProvider.js'
import { createOrgEngine } from '../../../../src/adapter/org/orgEngine.js'
import { OrgMutationTestBed } from '../../../../src/adapter/org/orgMutationTestBed.js'
import { OrgSObjectSchemaProvider } from '../../../../src/adapter/org/orgSObjectSchemaProvider.js'
import type { EngineContext } from '../../../../src/port/executionEngine.js'

vi.mock('../../../../src/adapter/org/apexClassRepository.js')
vi.mock('../../../../src/adapter/org/apexSettingsRepository.js')
vi.mock('../../../../src/adapter/org/apexTestRunner.js')
vi.mock('../../../../src/adapter/org/apexTestSuiteRepository.js')
vi.mock('../../../../src/adapter/org/orgApexSourceProvider.js')
vi.mock('../../../../src/adapter/org/orgMutationTestBed.js')
vi.mock('../../../../src/adapter/org/orgSObjectSchemaProvider.js')

describe('createOrgEngine', () => {
  let ctx: EngineContext

  beforeEach(() => {
    // Arrange
    ctx = {
      connection: {} as Connection,
      apexClassName: 'TestClass',
      notify: vi.fn(),
    }
  })

  it('Given an engine context, When creating the org engine, Then the same ApexClassRepository instance reaches both the source and the test bed', async () => {
    // Act
    await createOrgEngine(ctx)

    // Assert
    expect(vi.mocked(ApexClassRepository)).toHaveBeenCalledTimes(1)
    const repositoryInstance = vi.mocked(ApexClassRepository).mock.instances[0]
    expect(vi.mocked(OrgApexSourceProvider).mock.calls[0][0]).toBe(
      repositoryInstance
    )
    expect(vi.mocked(OrgMutationTestBed).mock.calls[0][0]).toBe(
      repositoryInstance
    )
  })

  it('Given an engine context, When creating the org engine, Then exactly one ApexTestRunner is constructed', async () => {
    // Act
    await createOrgEngine(ctx)

    // Assert — the runner's two latches are session-scoped; a
    // second instance would re-emit the sync-fallback warning.
    expect(vi.mocked(ApexTestRunner)).toHaveBeenCalledTimes(1)
  })

  it('Given an engine context, When the runner reports a sync-transport fallback, Then ctx.notify receives the sync-transport-fallback notice carrying the raised error', async () => {
    // Act
    await createOrgEngine(ctx)
    const options = vi.mocked(ApexTestRunner).mock.calls[0][1]
    const fallbackError = new Error('View Setup permission required')
    options?.onSyncFallback?.(fallbackError)

    // Assert
    expect(ctx.notify).toHaveBeenCalledWith({
      kind: 'sync-transport-fallback',
      error: fallbackError,
    })
  })

  it('Given an engine context, When creating the org engine, Then apexClassName reaches the test bed construction', async () => {
    // Act
    await createOrgEngine(ctx)

    // Assert
    expect(vi.mocked(OrgMutationTestBed).mock.calls[0][3]).toBe('TestClass')
  })

  it('Given an engine context, When creating the org engine, Then the source is composed from the repository and the suite repository', async () => {
    // Act
    await createOrgEngine(ctx)

    // Assert
    expect(vi.mocked(ApexTestSuiteRepository)).toHaveBeenCalledWith(
      ctx.connection
    )
    expect(vi.mocked(OrgApexSourceProvider).mock.calls[0][1]).toBe(
      vi.mocked(ApexTestSuiteRepository).mock.instances[0]
    )
  })

  it('Given an engine context, When creating the org engine, Then the schema is an OrgSObjectSchemaProvider built from the connection', async () => {
    // Act
    await createOrgEngine(ctx)

    // Assert
    expect(vi.mocked(OrgSObjectSchemaProvider)).toHaveBeenCalledWith(
      ctx.connection
    )
  })

  it('Given an engine context, When creating the org engine, Then the settings repository is built from the connection and reaches the test bed', async () => {
    // Act
    await createOrgEngine(ctx)

    // Assert
    expect(vi.mocked(ApexSettingsRepository)).toHaveBeenCalledWith(
      ctx.connection
    )
    expect(vi.mocked(OrgMutationTestBed).mock.calls[0][2]).toBe(
      vi.mocked(ApexSettingsRepository).mock.instances[0]
    )
  })
})
