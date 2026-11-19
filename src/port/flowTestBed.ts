import type { FlowSource } from './flowSourceProvider.js'

// A mutant that the org refuses to save or to activate is data crossing the
// port, not an exception (ADR 087, same as the Apex test bed): the service
// classifies it as CompileError without inspecting any error.
export type FlowMutantVerdict =
  | { kind: 'not-compilable'; detail: string }
  | { kind: 'executed'; failingTests: string[] }

export interface FlowBaseline {
  testsRan: number
  failingTests: string[]
  cost: { applyMs: number; runMs: number }
}

export interface FlowPrepareHooks {
  onPreparing(): void
  onPrepared(): void
  onBaselineStarting(): void
}

// The seam that keeps the org SDK out of the Flow service. prepare is a
// precondition of evaluate; restore undoes whatever prepare and evaluate
// changed in the org, and is safe to call after a prepare that failed
// part-way — it restores only what was actually changed. needsRestore says
// whether there is anything to restore: false until prepare is about to
// write, so a refusal before any write announces no restore.
export interface FlowTestBed {
  prepare(source: FlowSource, hooks: FlowPrepareHooks): Promise<FlowBaseline>
  evaluate(mutatedXml: string): Promise<FlowMutantVerdict>
  needsRestore(): boolean
  restore(): Promise<void>
}
