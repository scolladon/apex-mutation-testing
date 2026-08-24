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
  // Both halves are short circuits: `some` over an empty pattern list is
  // already false, and a line past the end of the source yields `undefined`,
  // which no pattern can match. Skipping them changes cost, not the verdict.
  // Stryker disable next-line ConditionalExpression,EqualityOperator: short circuit only.
  if (skipPatterns.length === 0 || sourceLines.length < line) {
    return false
  }
  const sourceLine = sourceLines[line - 1]
  return skipPatterns.some(pattern => pattern.test(sourceLine))
}
