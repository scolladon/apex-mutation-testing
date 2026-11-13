import type {
  EngineBundle,
  EngineContext,
  FlowEngineBundle,
} from '../../port/executionEngine.js'
import {
  FlowApiVersionTooLowError,
  ProductionOrgError,
} from '../../port/flowErrors.js'
import { ApexClassRepository } from './apexClassRepository.js'
import { ApexSettingsRepository } from './apexSettingsRepository.js'
import { ApexTestRunner } from './apexTestRunner.js'
import { ApexTestSuiteRepository } from './apexTestSuiteRepository.js'
import { EntityDefinitionRepository } from './entityDefinitionRepository.js'
import { FlowMetadataRepository } from './flowMetadataRepository.js'
import { FlowTestDiscovery } from './flowTestDiscovery.js'
import { FlowTestResultRepository } from './flowTestResultRepository.js'
import { FlowVersionRepository } from './flowVersionRepository.js'
import { OrgApexSourceProvider } from './orgApexSourceProvider.js'
import { OrganizationRepository } from './organizationRepository.js'
import { OrgFlowSourceProvider } from './orgFlowSourceProvider.js'
import { OrgFlowTestBed } from './orgFlowTestBed.js'
import { OrgMutationTestBed } from './orgMutationTestBed.js'
import { OrgSObjectSchemaProvider } from './orgSObjectSchemaProvider.js'

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value))

// A failed read must degrade, never abort: this is the first org round-trip
// of every run, firing before class validation and before any progress
// output, and it is unconditional — a run that mints no bare aliases at all
// still pays for it. The org backend is not always a real Salesforce org
// (this repo also runs against a local aer server reached as an org alias),
// so an unguarded rejection here would turn a working feature into a hard
// abort over what is pure optional enrichment: `null` is already a fully
// supported answer that simply mints no bare aliases. Reported through the
// same notice readEntityRows uses on its own rejection; no specific type
// names are known yet at this point in the run.
const readOrgNamespace = async (ctx: EngineContext): Promise<string | null> => {
  try {
    return await new OrganizationRepository(
      ctx.connection
    ).readNamespacePrefix()
  } catch (error) {
    ctx.notify({
      kind: 'type-resolution-degraded',
      typeNames: [],
      error: toError(error),
    })
    return null
  }
}

const buildTestRunner = (ctx: EngineContext): ApexTestRunner =>
  new ApexTestRunner(ctx.connection, {
    onSyncFallback: error =>
      ctx.notify({ kind: 'sync-transport-fallback', error }),
  })

const buildSourceProvider = (
  ctx: EngineContext,
  apexClassRepository: ApexClassRepository,
  orgNamespace: string | null
): OrgApexSourceProvider =>
  new OrgApexSourceProvider(
    apexClassRepository,
    new ApexTestSuiteRepository(ctx.connection),
    new EntityDefinitionRepository(ctx.connection),
    ctx.notify,
    orgNamespace
  )

const buildTestBed = (
  ctx: EngineContext,
  apexClassRepository: ApexClassRepository,
  apexTestRunner: ApexTestRunner
): OrgMutationTestBed =>
  new OrgMutationTestBed(
    apexClassRepository,
    apexTestRunner,
    new ApexSettingsRepository(ctx.connection)
  )

export const createOrgEngine = async (
  ctx: EngineContext
): Promise<EngineBundle> => {
  const apexClassRepository = new ApexClassRepository(ctx.connection)
  const apexTestRunner = buildTestRunner(ctx)
  // Read once per run, never per class or per mutant: a bare spelling is
  // only legal source for the org's own namespace, and every class mutated
  // in this run shares the same org.
  const orgNamespace = await readOrgNamespace(ctx)
  return {
    source: buildSourceProvider(ctx, apexClassRepository, orgNamespace),
    schema: new OrgSObjectSchemaProvider(
      ctx.connection,
      ctx.notify,
      orgNamespace
    ),
    testBed: buildTestBed(ctx, apexClassRepository, apexTestRunner),
  }
}

// The Test Discovery resource that lists a flow's FlowTests by name, and the
// FlowTest field that associates a test with one flow version, both arrive
// with API 66.0: below it the engine could neither find nor pin the tests.
export const MINIMUM_FLOW_API_VERSION = '66.0'

const assertFlowApiVersion = (apiVersion: string): void => {
  if (Number(apiVersion) < Number(MINIMUM_FLOW_API_VERSION)) {
    throw new FlowApiVersionTooLowError(apiVersion, MINIMUM_FLOW_API_VERSION)
  }
}

export interface FlowEngineOptions {
  // Explicit opt-in for orgs that report IsSandbox=false (Developer Edition,
  // Trailhead — but also production: the caller owns that responsibility).
  // Skips the sandbox check entirely, so the org is not even queried for it.
  allowNonSandbox?: boolean
}

// Every check that must hold before the Flow engine may exist runs here,
// before any port is handed out: a non-sandbox org never gets a test bed
// unless the caller opted in explicitly, and neither does a dry run against
// one.
export const createOrgFlowEngine = async (
  ctx: EngineContext,
  options: FlowEngineOptions = {}
): Promise<FlowEngineBundle> => {
  assertFlowApiVersion(ctx.connection.getApiVersion())
  if (
    !options.allowNonSandbox &&
    !(await new OrganizationRepository(ctx.connection).readIsSandbox())
  ) {
    throw new ProductionOrgError()
  }
  const metadata = new FlowMetadataRepository(ctx.connection)
  return {
    source: new OrgFlowSourceProvider(
      metadata,
      new FlowTestDiscovery(ctx.connection)
    ),
    testBed: new OrgFlowTestBed(
      metadata,
      new FlowVersionRepository(ctx.connection),
      new FlowTestResultRepository(ctx.connection),
      buildTestRunner(ctx)
    ),
  }
}
