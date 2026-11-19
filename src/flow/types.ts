import type { FlowXmlDom, SourcePosition, XmlEdit } from './xml/FlowXmlDom.js'

type FlowMutantStatus =
  | 'Pending'
  | 'Killed'
  | 'Survived'
  | 'CompileError'
  | 'RuntimeError'

// What a mutator produces: what it changes and why, as edits against the
// original XML — never a copy of the mutated document, which is only built,
// from these edits, when the mutant is deployed. edits is never empty.
export interface FlowMutation {
  mutatorName: string
  elementName: string
  description: string
  edits: XmlEdit[]
  // The span of the original XML the mutant changes as a user reads it, and
  // what it reads there instead: the report marks it, --lines filters on its
  // first line. It is not always an edit's span — bypassing an element edits
  // the connectors of its predecessors, but changes the element.
  anchor: { start: number; end: number }
  replacement: string
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
}

export interface FlowMutationResult {
  flowApiName: string
  sourceXml: string
  // The FlowTests every evaluated mutant was run against.
  testNames: string[]
  mutants: FlowMutant[]
}
