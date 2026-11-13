import type { Connection } from '@salesforce/core'
import type { ApexSourceProvider } from './apexSourceProvider.js'
import type { FlowSourceProvider } from './flowSourceProvider.js'
import type { FlowTestBed } from './flowTestBed.js'
import type { MutationTestBed } from './mutationTestBed.js'
import type { SObjectSchemaProvider } from './sObjectSchemaProvider.js'

export type EngineNotice =
  | { kind: 'sync-transport-fallback'; error: Error }
  | { kind: 'type-resolution-degraded'; typeNames: string[]; error?: Error }

export type EngineNotify = (notice: EngineNotice) => void

export interface EngineContext {
  connection: Connection
  notify: EngineNotify
}

export interface EngineBundle {
  source: ApexSourceProvider
  schema: SObjectSchemaProvider
  testBed: MutationTestBed
}

export interface FlowEngineBundle {
  source: FlowSourceProvider
  testBed: FlowTestBed
}
