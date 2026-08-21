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
  const orgNamespace = await new OrganizationRepository(
    ctx.connection
  ).readNamespacePrefix()
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
