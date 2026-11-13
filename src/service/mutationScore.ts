// The one formula every engine scores with, so a --threshold means the same
// thing whichever command enforces it. What varies per engine is only which
// statuses count as detected and which leave the denominator — the policy —
// never the arithmetic: the score is a plain percentage, never rounded.
export interface ScorePolicy {
  detected: ReadonlySet<string>
  excluded: ReadonlySet<string>
}

// Apex scores a RuntimeError as detected: an exception thrown while the tests
// ran against a mutant is, in the common case, the mutant's own fault.
export const APEX_SCORE_POLICY: ScorePolicy = {
  detected: new Set(['Killed', 'RuntimeError']),
  excluded: new Set(['CompileError']),
}

// A Flow fault raised while a FlowTest runs comes back as an ordinary failing
// test row, i.e. Killed. The only way a Flow mutant ends up RuntimeError is a
// transport failure — the test run itself never answered — which says nothing
// about the mutant, so it leaves the denominator instead of inflating the score.
export const FLOW_SCORE_POLICY: ScorePolicy = {
  detected: new Set(['Killed']),
  excluded: new Set(['CompileError', 'RuntimeError']),
}

export const calculateMutationScore = (
  statuses: readonly string[],
  policy: ScorePolicy
): number => {
  const scored = statuses.filter(status => !policy.excluded.has(status))
  if (scored.length === 0) {
    return 0
  }
  const detected = scored.filter(status => policy.detected.has(status)).length
  return (detected / scored.length) * 100
}
