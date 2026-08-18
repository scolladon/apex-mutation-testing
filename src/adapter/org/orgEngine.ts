import type { EngineBundle, EngineContext } from '../../port/executionEngine.js'
import { ApexClassRepository } from './apexClassRepository.js'
import { ApexSettingsRepository } from './apexSettingsRepository.js'
import { ApexTestRunner } from './apexTestRunner.js'
import { ApexTestSuiteRepository } from './apexTestSuiteRepository.js'
import { OrgApexSourceProvider } from './orgApexSourceProvider.js'
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
  return {
    source: new OrgApexSourceProvider(
      apexClassRepository,
      new ApexTestSuiteRepository(ctx.connection)
    ),
    schema: new OrgSObjectSchemaProvider(ctx.connection),
    testBed: new OrgMutationTestBed(
      apexClassRepository,
      apexTestRunner,
      new ApexSettingsRepository(ctx.connection),
      ctx.apexClassName
    ),
  }
}
