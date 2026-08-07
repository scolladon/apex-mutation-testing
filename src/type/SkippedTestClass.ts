export type UnusableReason = 'not-a-test-class' | 'not-readable' | 'no-coverage'

export interface SkippedTestClass {
  className: string
  reason: UnusableReason
  suiteNames?: string[]
}
