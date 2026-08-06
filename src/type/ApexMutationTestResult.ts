import type { TestMethodId } from './TestMethodId.js'

export interface ApexMutationTestResult {
  sourceFile: string
  sourceFileContent: string
  testFiles: string[]
  mutants: {
    id: string
    mutatorName: string
    status:
      | 'Killed'
      | 'Survived'
      | 'NoCoverage'
      | 'CompileError'
      | 'RuntimeError'
      | 'Pending'
    statusReason?: string
    // Presence means "this mutant was run and we know who ran it"; absence
    // means "no run data". The three fields are meaningful only together.
    attribution?: {
      coveredBy: TestMethodId[] // sorted, non-empty
      killedBy: TestMethodId[] // sorted, possibly empty
      testsCompleted: number
    }
    location: {
      start: { line: number; column: number }
      end: { line: number; column: number }
    }
    replacement: string
    original: string
  }[]
}
