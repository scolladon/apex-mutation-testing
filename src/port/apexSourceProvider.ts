import type { ApexClass } from '../type/ApexClass.js'
import type { SkippedTestClass } from '../type/SkippedTestClass.js'
import type { TestClassResolution } from '../type/TestClassResolution.js'

// Moved here from src/adapter/org/apexTestSuiteRepository.ts: a port module
// must never import from an adapter, and this shape crosses the port.
export interface ApexTestSuiteMember {
  suiteName: string
  className: string
}

/** One org type with every spelling the source under mutation may write for it.
 *  `apiName` is the one true name — what describe() receives and what the schema
 *  is keyed by. `aliases` always contains `apiName`, and a bare (unqualified)
 *  alias is only ever present for a type the org's own namespace owns — a
 *  bare spelling is not legal source for a foreign namespace's type. */
export interface TypeName {
  apiName: string
  aliases: string[]
}

export interface TypeDependencies {
  apexClasses: TypeName[]
  sObjects: TypeName[] // StandardEntity ∪ CustomObject, already merged
}

export interface PerimeterAssessment {
  skipped: SkippedTestClass[]
  resolutions: TestClassResolution[]
}

// Strings only, no org vocabulary: both list-carrying verdicts are rendered
// by the adapter that classified the candidates, so the port never leaks a
// ManageableState spelling or a namespace shape to its callers.
export type TargetClassVerdict =
  | { kind: 'mutable' }
  | { kind: 'not-mutable'; states: string[] } // display-ready, e.g. ['installed']
  | { kind: 'ambiguous'; spellings: string[] } // e.g. ['Argument', 'mockery.Argument']
  | { kind: 'unqualified'; spelling: string } // the one match is foreign, e.g. 'mockery.Argument'
  | { kind: 'not-found' }

export interface ApexSourceProvider {
  assessTargetClass(name: string): Promise<TargetClassVerdict>
  readClass(name: string): Promise<ApexClass>
  listDependencies(apexClass: ApexClass): Promise<TypeDependencies>
  assessPerimeter(names: string[]): Promise<PerimeterAssessment>
  readTestSuiteMembers(suiteNames: string[]): Promise<ApexTestSuiteMember[]>
  readExistingTestSuiteNames(suiteNames: string[]): Promise<string[]>
}
