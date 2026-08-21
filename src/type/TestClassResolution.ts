export interface TestClassResolution {
  classId: string
  /** The FQN when the class carries a namespace, the bare name otherwise. */
  displayName: string
  /** The folded spellings this class answers to: the qualified spelling
   *  always, plus the bare spelling when this row is the org's own
   *  namespace or the bare name's sole claimant among the resolved set. */
  lookupKeys: readonly string[]
}

export type TestClassResolutions = ReadonlyMap<string, TestClassResolution> // keyed by classId
