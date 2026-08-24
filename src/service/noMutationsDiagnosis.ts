import { isLineSkipped, isLineWithinAllowed } from './lineEligibility.js'
import type { SkipPattern } from './skipPattern.js'

// Why the mutation set came back empty. Reported in filter order — the first
// filter that emptied the candidate set is the one the user has to change,
// so a narrower --lines window is named before the skip patterns it makes
// irrelevant, and both before the mutator registry.
export type NoMutationsDiagnosis =
  | { reason: 'line-range'; coveredCount: number }
  | { reason: 'skip-patterns'; inRangeCount: number }
  | { reason: 'mutator-filter'; eligibleCount: number }
  | { reason: 'no-mutable-pattern'; coveredCount: number }

export interface NoMutationsInputs {
  coveredLines: Set<number>
  allowedLines: Set<number> | undefined
  skipPatterns: SkipPattern[]
  sourceLines: string[]
  mutatorFilterActive: boolean
}

export const diagnoseNoMutations = ({
  coveredLines,
  allowedLines,
  skipPatterns,
  sourceLines,
  mutatorFilterActive,
}: NoMutationsInputs): NoMutationsDiagnosis => {
  const coveredCount = coveredLines.size

  const inRange = [...coveredLines].filter(line =>
    isLineWithinAllowed(line, allowedLines)
  )
  if (inRange.length === 0) {
    return { reason: 'line-range', coveredCount }
  }

  const eligible = inRange.filter(
    line => !isLineSkipped(line, skipPatterns, sourceLines)
  )
  if (eligible.length === 0) {
    return { reason: 'skip-patterns', inRangeCount: inRange.length }
  }

  if (mutatorFilterActive) {
    return { reason: 'mutator-filter', eligibleCount: eligible.length }
  }

  return { reason: 'no-mutable-pattern', coveredCount }
}
