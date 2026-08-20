import type { ApexClass } from '../type/ApexClass.js'
import type { SkippedTestClass } from '../type/SkippedTestClass.js'

// Moved here from src/adapter/org/apexTestSuiteRepository.ts: a port module
// must never import from an adapter, and this shape crosses the port.
export interface ApexTestSuiteMember {
  suiteName: string
  className: string
}

export interface TypeDependencies {
  apexClasses: string[]
  sObjects: string[] // StandardEntity ∪ CustomObject, already merged
}

/** One org type with every spelling the source under mutation may write for it.
 *  `apiName` is the one true name — what describe() receives and what the schema
 *  is keyed by. `aliases` always contains `apiName`. */
export interface TypeName {
  apiName: string
  aliases: string[]
}

export interface ApexSourceProvider {
  classExists(name: string): Promise<boolean>
  readClass(name: string): Promise<ApexClass>
  listDependencies(apexClass: ApexClass): Promise<TypeDependencies>
  assessPerimeter(names: string[]): Promise<SkippedTestClass[]>
  readTestSuiteMembers(suiteNames: string[]): Promise<ApexTestSuiteMember[]>
  readExistingTestSuiteNames(suiteNames: string[]): Promise<string[]>
}
