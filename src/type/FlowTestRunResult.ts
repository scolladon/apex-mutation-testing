// The plugin-owned shape of one FlowTest run, mapped from the vendor SDK's
// TestResult by ApexTestRunner — the Flow counterpart of ApexTestRunResult,
// reduced to what the Flow engine reads: which tests ran and how each ended.
interface FlowTestMethodResult {
  methodName: string
  outcome: string
}

export interface FlowTestRunResult {
  outcome: string
  tests: FlowTestMethodResult[]
}
