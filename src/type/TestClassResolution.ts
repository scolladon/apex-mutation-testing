export interface TestClassResolution {
  classId: string
  /** The FQN when the class carries a namespace, the bare name otherwise. */
  displayName: string
  /** The folded spellings this class answers to — bare and qualified. */
  lookupKeys: readonly string[]
}

export type TestClassResolutions = ReadonlyMap<string, TestClassResolution> // keyed by classId
