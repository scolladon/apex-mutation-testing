// Domain shape of a test run, owned by src/ rather than mirrored from the
// vendor SDK — the synchronous and asynchronous transports each map their
// own SDK DTO into this one shape in src/adapter/org/apexTestRunner.ts, so
// src/service/ never needs to know which transport produced a result.
// Field names and nesting intentionally track what src/service/ actually
// reads (see groupExecutor.ts and coverageStrategy.ts) rather than the SDK's
// own vocabulary. classId is an org Id and the join key across baseline and
// mutant runs; className is the bare class name, display only.

export interface ApexTestMethodCoverage {
  classId: string
  className: string
  testMethodName: string
  detail?: {
    coveredLines: number[]
  } | null
}

export interface ApexTestMethodResult {
  classId: string
  className: string
  methodName: string
  outcome: string
  coverage?: ApexTestMethodCoverage[] | null
}

export interface ApexClassCoverage {
  classId: string
  className: string
  coveredLines: number[]
}

export interface ApexTestRunResult {
  outcome: string
  tests: ApexTestMethodResult[]
  classCoverage?: ApexClassCoverage[] | null
}
