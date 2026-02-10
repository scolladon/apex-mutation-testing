export interface ApexMutationTestResult {
  sourceFile: string
  sourceFileContent: string
  testFile: string
  mutants: {
    id: string
    mutatorName: string
    status:
      | 'Killed'
      | 'Survived'
      | 'NoCoverage'
      | 'CompileError'
      | 'RuntimeError'
    statusReason?: string
    location: {
      start: { line: number; column: number }
      end: { line: number; column: number }
    }
    replacement: string
    original: string
  }[]
}
