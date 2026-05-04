import { MutationGrouper } from '../../../../src/service/mutationGrouper.js'
import { ApexMutation } from '../../../../src/type/ApexMutation.js'

export const mutationAt = (line: number, name = `m@${line}`): ApexMutation =>
  ({
    mutationName: name,
    replacement: 'X',
    target: {
      // Only `startToken.line` is read by the grouping layer.
      startToken: { line } as never,
      endToken: { line } as never,
      text: 'orig',
    },
  }) as ApexMutation

export const coverage = (
  entries: Array<[number, string[]]>
): Map<number, Set<string>> =>
  new Map(entries.map(([line, tests]) => [line, new Set(tests)]))

export const everyMutationAppearsExactlyOnce = (
  groups: ReturnType<MutationGrouper['group']>,
  mutations: ApexMutation[]
): boolean => {
  const flat = groups.flatMap(g => g.mutations)
  return (
    flat.length === mutations.length &&
    new Set(flat).size === mutations.length &&
    flat.every(m => mutations.includes(m))
  )
}

export const noGroupHasInternalConflict = (
  groups: ReturnType<MutationGrouper['group']>,
  testMethodsPerLine: Map<number, Set<string>>
): boolean =>
  groups.every(g => {
    const seen = new Set<string>()
    for (const m of g.mutations) {
      const tests =
        testMethodsPerLine.get(m.target.startToken.line) ?? new Set()
      for (const t of tests) {
        if (seen.has(t)) return false
        seen.add(t)
      }
    }
    return true
  })
