import type { Connection } from '@salesforce/core'
import { ApexTestRunner } from '../../../../src/adapter/org/apexTestRunner.js'
import { FlowMetadataRepository } from '../../../../src/adapter/org/flowMetadataRepository.js'
import { FlowTestResultRepository } from '../../../../src/adapter/org/flowTestResultRepository.js'
import { FlowVersionRepository } from '../../../../src/adapter/org/flowVersionRepository.js'
import { OrganizationRepository } from '../../../../src/adapter/org/organizationRepository.js'
import {
  createOrgFlowEngine,
  MINIMUM_FLOW_API_VERSION,
} from '../../../../src/adapter/org/orgEngine.js'
import { OrgFlowSourceProvider } from '../../../../src/adapter/org/orgFlowSourceProvider.js'
import { OrgFlowTestBed } from '../../../../src/adapter/org/orgFlowTestBed.js'
import type { EngineContext } from '../../../../src/port/executionEngine.js'
import {
  FlowApiVersionTooLowError,
  FlowNamespacedOrgError,
  ProductionOrgError,
} from '../../../../src/port/flowErrors.js'

vi.mock('../../../../src/adapter/org/apexTestRunner.js')
vi.mock('../../../../src/adapter/org/flowMetadataRepository.js')
vi.mock('../../../../src/adapter/org/flowTestDiscovery.js')
vi.mock('../../../../src/adapter/org/flowTestResultRepository.js')
vi.mock('../../../../src/adapter/org/flowVersionRepository.js')
vi.mock('../../../../src/adapter/org/orgFlowSourceProvider.js')
vi.mock('../../../../src/adapter/org/orgFlowTestBed.js')
vi.mock('../../../../src/adapter/org/organizationRepository.js')

const SANDBOX = {
  isSandbox: true,
  organizationType: 'Enterprise Edition',
  namespacePrefix: null,
}

describe('createOrgFlowEngine', () => {
  const readOrganizationKind = vi.fn()
  const ctx = (apiVersion = '66.0'): EngineContext => ({
    connection: { getApiVersion: () => apiVersion } as unknown as Connection,
    notify: vi.fn(),
  })

  beforeEach(() => {
    vi.mocked(OrganizationRepository).mockImplementation(
      class {
        readOrganizationKind = readOrganizationKind
      } as unknown as new (
        connection: Connection
      ) => OrganizationRepository
    )
  })

  it('Given a sandbox on API 66.0, When created, Then one metadata repository serves both the source and the test bed', async () => {
    // Arrange
    readOrganizationKind.mockResolvedValue(SANDBOX)

    // Act
    const engine = await createOrgFlowEngine(ctx())

    // Assert
    expect(vi.mocked(FlowMetadataRepository)).toHaveBeenCalledTimes(1)
    const metadata = vi.mocked(FlowMetadataRepository).mock.instances[0]
    expect(vi.mocked(OrgFlowSourceProvider).mock.calls[0][0]).toBe(metadata)
    expect(vi.mocked(OrgFlowTestBed).mock.calls[0]).toEqual([
      metadata,
      vi.mocked(FlowVersionRepository).mock.instances[0],
      vi.mocked(FlowTestResultRepository).mock.instances[0],
      vi.mocked(ApexTestRunner).mock.instances[0],
    ])
    expect(engine.source).toBe(
      vi.mocked(OrgFlowSourceProvider).mock.instances[0]
    )
    expect(engine.testBed).toBe(vi.mocked(OrgFlowTestBed).mock.instances[0])
  })

  it('Given a sandbox, When the runner falls back to the asynchronous transport, Then the notice reaches ctx.notify', async () => {
    // Arrange
    readOrganizationKind.mockResolvedValue(SANDBOX)
    const context = ctx()
    await createOrgFlowEngine(context)
    const fallback = new Error('View Setup required')

    // Act
    vi.mocked(ApexTestRunner).mock.calls[0][1]?.onSyncFallback?.(fallback)

    // Assert
    expect(context.notify).toHaveBeenCalledWith({
      kind: 'sync-transport-fallback',
      error: fallback,
    })
  })

  it.each([
    ['Enterprise Edition'],
    ['Unlimited Edition'],
    ['Partner Developer Edition'],
    ['developer edition'],
    [null],
  ])(
    'Given a production org of type %j, When created, Then it refuses and builds no port',
    async organizationType => {
      // Arrange
      readOrganizationKind.mockResolvedValue({
        isSandbox: false,
        organizationType,
        namespacePrefix: null,
      })

      // Act & Assert
      await expect(createOrgFlowEngine(ctx())).rejects.toBeInstanceOf(
        ProductionOrgError
      )
      expect(vi.mocked(OrgFlowTestBed)).not.toHaveBeenCalled()
    }
  )

  it('Given a Developer Edition org (Trailhead playgrounds included), When created, Then it is accepted though it is no sandbox', async () => {
    // Arrange — what a Developer Edition org and a Trailhead playground report
    readOrganizationKind.mockResolvedValue({
      isSandbox: false,
      organizationType: 'Developer Edition',
      namespacePrefix: null,
    })

    // Act
    const engine = await createOrgFlowEngine(ctx())

    // Assert
    expect(engine.testBed).toBe(vi.mocked(OrgFlowTestBed).mock.instances[0])
  })

  it('Given the sandbox check itself fails, When created, Then it fails closed', async () => {
    // Arrange
    readOrganizationKind.mockRejectedValue(new Error('INVALID_SESSION_ID'))

    // Act & Assert
    await expect(createOrgFlowEngine(ctx())).rejects.toThrow(
      'INVALID_SESSION_ID'
    )
    expect(vi.mocked(OrgFlowTestBed)).not.toHaveBeenCalled()
  })

  it.each([['65.0'], ['9.0']])(
    'Given API %s, When created, Then it refuses before querying the org',
    async apiVersion => {
      // Act & Assert
      await expect(createOrgFlowEngine(ctx(apiVersion))).rejects.toEqual(
        new FlowApiVersionTooLowError(apiVersion, MINIMUM_FLOW_API_VERSION)
      )
      expect(readOrganizationKind).not.toHaveBeenCalled()
    }
  )

  it('Given a later API version, When created, Then it is accepted', async () => {
    // Arrange
    readOrganizationKind.mockResolvedValue(SANDBOX)

    // Act & Assert
    await expect(createOrgFlowEngine(ctx('100.0'))).resolves.toBeDefined()
  })

  it.each([
    [{ isSandbox: true, organizationType: 'Enterprise Edition' }],
    [{ isSandbox: false, organizationType: 'Developer Edition' }],
  ])(
    'Given an accepted org %j with a namespace, When created, Then it refuses before building any port',
    async kind => {
      // Arrange
      readOrganizationKind.mockResolvedValue({
        ...kind,
        namespacePrefix: 'acme',
      })

      // Act & Assert
      await expect(createOrgFlowEngine(ctx())).rejects.toEqual(
        new FlowNamespacedOrgError('acme')
      )
      expect(vi.mocked(FlowMetadataRepository)).not.toHaveBeenCalled()
      expect(vi.mocked(OrgFlowTestBed)).not.toHaveBeenCalled()
    }
  )

  it('Given a production org with a namespace, When created, Then the org refusal comes first', async () => {
    // Arrange
    readOrganizationKind.mockResolvedValue({
      isSandbox: false,
      organizationType: 'Enterprise Edition',
      namespacePrefix: 'acme',
    })

    // Act & Assert
    await expect(createOrgFlowEngine(ctx())).rejects.toBeInstanceOf(
      ProductionOrgError
    )
  })
})
