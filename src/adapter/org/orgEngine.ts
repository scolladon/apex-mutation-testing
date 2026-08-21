import type { EngineBundle, EngineContext } from '../../port/executionEngine.js'
import { ApexClassRepository } from './apexClassRepository.js'
import { ApexSettingsRepository } from './apexSettingsRepository.js'
import { ApexTestRunner } from './apexTestRunner.js'
import { ApexTestSuiteRepository } from './apexTestSuiteRepository.js'
import { EntityDefinitionRepository } from './entityDefinitionRepository.js'
import { OrgApexSourceProvider } from './orgApexSourceProvider.js'
import { OrganizationRepository } from './organizationRepository.js'
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

export const createOrgEngine = async (
  ctx: EngineContext
): Promise<EngineBundle> => {
  const apexClassRepository = new ApexClassRepository(ctx.connection)
  const apexTestRunner = new ApexTestRunner(ctx.connection, {
    onSyncFallback: error =>
      ctx.notify({ kind: 'sync-transport-fallback', error }),
  })
  // Read once per run, never per class or per mutant: a bare spelling is
  // only legal source for the org's own namespace, and every class mutated
  // in this run shares the same org.
  const orgNamespace = await readOrgNamespace(ctx)
  return {
    source: new OrgApexSourceProvider(
      apexClassRepository,
      new ApexTestSuiteRepository(ctx.connection),
      new EntityDefinitionRepository(ctx.connection),
      ctx.notify,
      orgNamespace
    ),
    schema: new OrgSObjectSchemaProvider(
      ctx.connection,
      ctx.notify,
      orgNamespace
    ),
    testBed: new OrgMutationTestBed(
      apexClassRepository,
      apexTestRunner,
      new ApexSettingsRepository(ctx.connection),
      ctx.apexClassName
    ),
  }
}
