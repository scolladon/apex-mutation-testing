export type FlowMutantStatus =
  | 'Pending'
  | 'Killed'
  | 'Survived'
  | 'CompileError'

export interface FlowMutant {
  id: string
  mutatorName: string
  elementName: string
  description: string
  originalSnippet: string
  mutatedSnippet: string
  mutatedXml: string
  status: FlowMutantStatus
  lineNumber?: number
  killedBy?: string[]
}

export interface FlowMutator {
  readonly name: string
  mutate(xmlContent: string): Omit<FlowMutant, 'id' | 'status'>[]
}

export interface FlowDeployResult {
  success: boolean
  errorMessage?: string
}

export interface FlowTestRunResult {
  allPassed: boolean
  failingMethods: string[]
  testsRan?: number
}

export interface FlowSalesforcePort {
  deployFlowXml(
    flowFilePath: string,
    xmlContent: string
  ): Promise<FlowDeployResult>
  deployFiles(filePaths: string[]): Promise<FlowDeployResult>
  runFlowTests(
    flowName: string,
    testNames?: string[]
  ): Promise<FlowTestRunResult>
  runApexTests(testClasses: string[]): Promise<FlowTestRunResult>
  getLatestFlowVersion(
    flowApiName: string
  ): Promise<{ versionNumber: number; flowId?: string }>
  deleteFlowVersion?(flowId: string): Promise<boolean>
  retrieveFlow?(flowName: string, outputDir: string): Promise<string>
}

export interface FlowOrchestratorCallbacks {
  onValidating?: () => void
  onValidated?: () => void
  onBaselineDeploying?: () => void
  onBaselineDeployed?: () => void
  onBaselineTesting?: () => void
  onBaselineTested?: (resultMsg: string) => void
  onMutantsGenerating?: () => void
  onMutantsGenerated?: (count: number) => void
  onTimeEstimate?: (
    deployTime: number,
    testTime: number,
    mutationCount: number,
    groupCount: number
  ) => void
  onProgressStart?: (total: number) => void
  onProgressUpdate?: (current: number, info: string) => void
  onProgressFinish?: (info: string) => void
  onRollbackStarting?: () => void
  onRollbackFinished?: (failed?: boolean) => void
}

export interface FlowMutationReport {
  flowFilePath: string
  totalMutants: number
  killed: number
  survived: number
  compileErrors: number
  mutationScore: number
  mutants: FlowMutant[]
  originalXml?: string
}
