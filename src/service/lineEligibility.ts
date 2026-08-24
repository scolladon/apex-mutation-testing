import type { SkipPattern } from './skipPattern.js'

// The two line-level filters a mutation candidate must survive, shared by the
// walker's hot path (MutationListener.isLineEligible) and the cold-path
// diagnosis that explains an empty mutation set. Keeping one definition means
// a change to either rule cannot silently make the diagnosis lie.

export const isLineWithinAllowed = (
  line: number,
  allowedLines: Set<number> | undefined
): boolean => allowedLines === undefined || allowedLines.has(line)

export const isLineSkipped = (
  line: number,
  skipPatterns: SkipPattern[],
  sourceLines: string[]
): boolean => {
  // The range check is load-bearing, not a cost optimisation: an out-of-range
  // index yields `undefined`, and RE2JS `test(undefined)` throws rather than
  // failing to match. Both bounds matter — the walker never asks about a
  // non-positive line, but the diagnosis iterates org-supplied covered lines.
  //
  // The leading `skipPatterns.length === 0` clause, however, is not
  // observable: dropping it does not skip the range guard (still evaluated
  // via `||`), so when patterns are empty `sourceLine` stays a valid,
  // in-range access and `[].some(...)` below is false regardless — same
  // verdict, one extra no-op array access. Verified by hand-mutating this
  // clause to `false` and running the full unit+integration+NUT suite
  // (2115 tests): all pass unchanged. (No `Stryker disable` here — a prior
  // stale disable on this exact line once hid four genuinely-killed
  // mutants; do not reintroduce one.)
  if (skipPatterns.length === 0 || line < 1 || sourceLines.length < line) {
    return false
  }
  const sourceLine = sourceLines[line - 1]
  return skipPatterns.some(pattern => pattern.test(sourceLine))
}
