import { ApexMutation } from '../type/ApexMutation.js'

export interface MutationGroup {
  mutations: ApexMutation[]
  testMethods: Set<string>
}

export interface GrouperInput {
  mutations: ApexMutation[]
  testMethodsPerLine: Map<number, Set<string>>
}

export interface MutationGrouper {
  group(input: GrouperInput): MutationGroup[]
}

export const testsForMutation = (
  mutation: ApexMutation,
  testMethodsPerLine: Map<number, Set<string>>
): Set<string> =>
  testMethodsPerLine.get(mutation.target.startToken.line) ?? new Set()

export const conflicts = (a: Set<string>, b: Set<string>): boolean => {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  for (const t of small) {
    if (large.has(t)) return true
  }
  return false
}

// Defensive check: a grouper must produce a partition of the input mutations
// (every input appears exactly once across all groups). Cheap to verify,
// expensive to debug if violated.
export const assertGroupingInvariants = (
  mutations: ReadonlyArray<ApexMutation>,
  groups: ReadonlyArray<MutationGroup>
): void => {
  const flat = groups.flatMap(g => g.mutations)
  if (
    flat.length !== mutations.length ||
    new Set(flat).size !== mutations.length
  ) {
    throw new Error(
      `Grouping invariant violated: ${mutations.length} input mutations produced ${flat.length} grouped (unique: ${new Set(flat).size})`
    )
  }
}
