import type { FlowXmlDom, SourcePosition, XmlEdit } from './xml/FlowXmlDom.js'

type FlowMutantStatus =
  | 'Pending'
  | 'Killed'
  | 'Survived'
  | 'CompileError'
  | 'RuntimeError'

// What a mutator produces: what it changes and why, as edits against the
// original XML — never a copy of the mutated document, which is only built,
// from these edits, when the mutant is deployed. edits is never empty; the
// first edit is the one the report points at.
export interface FlowMutation {
  mutatorName: string
  elementName: string
  description: string
  edits: XmlEdit[]
}

// Mutators only read the document: one parse serves every mutator.
export interface FlowMutator {
  readonly name: string
  mutate(dom: FlowXmlDom): FlowMutation[]
}

export interface FlowMutant extends FlowMutation {
  id: string
  status: FlowMutantStatus
  statusReason?: string
  killedBy?: string[]
  location: { start: SourcePosition; end: SourcePosition }
  replacement: string
}

export interface FlowMutationResult {
  flowApiName: string
  sourceXml: string
  mutants: FlowMutant[]
}
