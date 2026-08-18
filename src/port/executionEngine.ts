import type { Connection } from '@salesforce/core'
import type { ApexSourceProvider } from './apexSourceProvider.js'
import type { MutationTestBed } from './mutationTestBed.js'
import type { SObjectSchemaProvider } from './sObjectSchemaProvider.js'

export type EngineNotice = { kind: 'sync-transport-fallback'; error: Error }

export interface EngineContext {
  connection: Connection
  apexClassName: string
  notify: (notice: EngineNotice) => void
}

export interface EngineBundle {
  source: ApexSourceProvider
  schema: SObjectSchemaProvider
  testBed: MutationTestBed
}
