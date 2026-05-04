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
