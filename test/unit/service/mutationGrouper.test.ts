import {
  type GroupingResult,
  groupMutations,
  type MutationGroup,
} from '../../../src/service/mutationGrouper.js'
import { ApexMutation } from '../../../src/type/ApexMutation.js'

const mutationAt = (line: number, name = `m@${line}`): ApexMutation =>
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

const coverage = (
  entries: Array<[number, string[]]>
): Map<number, Set<string>> =>
  new Map(entries.map(([line, tests]) => [line, new Set(tests)]))

const everyMutationAppearsExactlyOnce = (
  groups: MutationGroup[],
  mutations: ApexMutation[]
): boolean => {
  const flat = groups.flatMap(g => g.mutations)
  return (
    flat.length === mutations.length &&
    new Set(flat).size === mutations.length &&
    flat.every(m => mutations.includes(m))
  )
}

const noGroupHasInternalConflict = (
  groups: MutationGroup[],
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

const groupOf = (
  result: GroupingResult,
  mutation: ApexMutation
): number | undefined =>
  result.groups.findIndex(g => g.mutations.includes(mutation))

describe('groupMutations', () => {
  it('given empty mutations when grouping then returns no groups and lowerBound 0', () => {
    // Arrange & Act
    const result = groupMutations([], coverage([]))

    // Assert
    expect(result.groups).toEqual([])
    expect(result.lowerBound).toBe(0)
  })

  it('given a single mutation when grouping then returns one group of size 1', () => {
    // Arrange
    const mutations = [mutationAt(1)]
    const testMethodsPerLine = coverage([[1, ['t1']]])

    // Act
    const result = groupMutations(mutations, testMethodsPerLine)

    // Assert
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].mutations).toEqual(mutations)
    expect(result.groups[0].testMethods).toEqual(new Set(['t1']))
    expect(result.lowerBound).toBe(1)
  })

  it('given two mutations with disjoint tests when grouping then merges into one group', () => {
    // Arrange
    const mutations = [mutationAt(1), mutationAt(2)]
    const testMethodsPerLine = coverage([
      [1, ['t1']],
      [2, ['t2']],
    ])

    // Act
    const result = groupMutations(mutations, testMethodsPerLine)

    // Assert
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].testMethods).toEqual(new Set(['t1', 't2']))
    expect(result.lowerBound).toBe(1)
  })

  it('given two mutations sharing a test when grouping then keeps them apart', () => {
    // Arrange
    const mutations = [mutationAt(1), mutationAt(2)]
    const testMethodsPerLine = coverage([
      [1, ['shared']],
      [2, ['shared']],
    ])

    // Act
    const result = groupMutations(mutations, testMethodsPerLine)

    // Assert
    expect(result.groups).toHaveLength(2)
    expect(result.lowerBound).toBe(2)
  })

  it('given a triangle of conflicts when grouping then yields three groups with vertices 0/1/2 receiving colors 0/1/2 respectively', () => {
    // Arrange — every pair shares a test.
    // Asserting precise color/group assignments kills `++candidate` →
    // `--candidate` and `let candidate = 0` → `= 1` mutants on
    // pickSmallestAvailableColor (round-2 finding B2).
    const m0 = mutationAt(1)
    const m1 = mutationAt(2)
    const m2 = mutationAt(3)
    const mutations = [m0, m1, m2]
    const testMethodsPerLine = coverage([
      [1, ['t12', 't13']],
      [2, ['t12', 't23']],
      [3, ['t13', 't23']],
    ])

    // Act
    const result = groupMutations(mutations, testMethodsPerLine)

    // Assert
    expect(result.groups).toHaveLength(3)
    expect(result.lowerBound).toBe(2)
    // Each mutation lands in a distinct group; the assignment uses the
    // smallest-available-color rule so the group set is exactly {0, 1, 2}
    // (kills `++candidate → --candidate` and `let candidate = 0 → = 1`
    // mutants on pickSmallestAvailableColor).
    expect(
      new Set([groupOf(result, m0), groupOf(result, m1), groupOf(result, m2)])
    ).toEqual(new Set([0, 1, 2]))
  })

  it('given fully disjoint coverage when grouping then collapses to a single group', () => {
    // Arrange
    const mutations = [
      mutationAt(1),
      mutationAt(2),
      mutationAt(3),
      mutationAt(4),
    ]
    const testMethodsPerLine = coverage([
      [1, ['ta']],
      [2, ['tb']],
      [3, ['tc']],
      [4, ['td']],
    ])

    // Act
    const result = groupMutations(mutations, testMethodsPerLine)

    // Assert
    expect(result.groups).toHaveLength(1)
    expect(result.lowerBound).toBe(1)
  })

  it('given a hub-and-spokes graph when grouping then yields the optimal 2 groups', () => {
    // Arrange — hub conflicts with each spoke; spokes mutually disjoint.
    const mutations = [
      mutationAt(1, 'hub'),
      mutationAt(2),
      mutationAt(3),
      mutationAt(4),
      mutationAt(5),
    ]
    const testMethodsPerLine = coverage([
      [1, ['t12', 't13', 't14', 't15']],
      [2, ['t12', 't2']],
      [3, ['t13', 't3']],
      [4, ['t14', 't4']],
      [5, ['t15', 't5']],
    ])

    // Act
    const result = groupMutations(mutations, testMethodsPerLine)

    // Assert
    expect(result.groups).toHaveLength(2)
    expect(result.lowerBound).toBe(2)
    expect(noGroupHasInternalConflict(result.groups, testMethodsPerLine)).toBe(
      true
    )
  })

  it('given a complete bipartite graph K(3,3) when grouping then returns the optimal 2 groups proven optimal by lowerBound', () => {
    // Arrange
    const mutations = [
      mutationAt(1, 'a1'),
      mutationAt(2, 'a2'),
      mutationAt(3, 'a3'),
      mutationAt(4, 'b1'),
      mutationAt(5, 'b2'),
      mutationAt(6, 'b3'),
    ]
    const testMethodsPerLine = coverage([
      [1, ['ta1', 'x14', 'x15', 'x16']],
      [2, ['ta2', 'x24', 'x25', 'x26']],
      [3, ['ta3', 'x34', 'x35', 'x36']],
      [4, ['tb1', 'x14', 'x24', 'x34']],
      [5, ['tb2', 'x15', 'x25', 'x35']],
      [6, ['tb3', 'x16', 'x26', 'x36']],
    ])

    // Act
    const result = groupMutations(mutations, testMethodsPerLine)

    // Assert — DSATUR is provably optimal on bipartite graphs (χ = 2). The
    // lowerBound matches groups.length, certifying optimality. Asserting all
    // colors are defined kills loop-bound off-by-one mutants on
    // `n - witness.length` (round-2 finding M3).
    expect(result.groups).toHaveLength(2)
    expect(result.lowerBound).toBe(2)
    expect(result.groups.every(g => g.mutations.length === 3)).toBe(true)
    expect(noGroupHasInternalConflict(result.groups, testMethodsPerLine)).toBe(
      true
    )
    expect(everyMutationAppearsExactlyOnce(result.groups, mutations)).toBe(true)
  })

  it('given a randomly-ordered mix when grouping then result is always a conflict-free partition', () => {
    // Arrange
    const mutations = [
      mutationAt(10, 'a'),
      mutationAt(20, 'b'),
      mutationAt(30, 'c'),
      mutationAt(40, 'd'),
      mutationAt(50, 'e'),
    ]
    const testMethodsPerLine = coverage([
      [10, ['t1', 't2']],
      [20, ['t3']],
      [30, ['t2', 't4']],
      [40, ['t5']],
      [50, ['t1', 't5']],
    ])

    // Act
    const result = groupMutations(mutations, testMethodsPerLine)

    // Assert
    expect(everyMutationAppearsExactlyOnce(result.groups, mutations)).toBe(true)
    expect(noGroupHasInternalConflict(result.groups, testMethodsPerLine)).toBe(
      true
    )
    expect(result.lowerBound).toBe(2)
  })

  it('given mutations with no covering tests when grouping then they all merge into one group', () => {
    // Arrange — empty test sets never conflict with anything
    const mutations = [mutationAt(1), mutationAt(2), mutationAt(3)]
    const testMethodsPerLine = coverage([])

    // Act
    const result = groupMutations(mutations, testMethodsPerLine)

    // Assert
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].mutations).toHaveLength(3)
    expect(result.lowerBound).toBe(0)
  })

  it('given a star where one test covers every mutation when grouping then each mutation lands in its own group with a distinct color', () => {
    // Arrange — all five mutations share covering test "t". The witness
    // clique therefore contains every mutation; pre-coloring assigns each a
    // distinct color, killing `color[v] = k ± 1` mutants on the seeding loop.
    const mutations = [
      mutationAt(1, 'm0'),
      mutationAt(2, 'm1'),
      mutationAt(3, 'm2'),
      mutationAt(4, 'm3'),
      mutationAt(5, 'm4'),
    ]
    const testMethodsPerLine = coverage([
      [1, ['t']],
      [2, ['t']],
      [3, ['t']],
      [4, ['t']],
      [5, ['t']],
    ])

    // Act
    const result = groupMutations(mutations, testMethodsPerLine)

    // Assert
    expect(result.groups).toHaveLength(5)
    expect(result.lowerBound).toBe(5)
    // Each mutation lands in a distinct group.
    const groupIndices = mutations.map(m => groupOf(result, m))
    expect(new Set(groupIndices).size).toBe(5)
  })

  it('given two disjoint test-induced cliques of sizes 3 and 5 when grouping then lowerBound matches the larger clique', () => {
    // Arrange — `tBig` covers 5 mutations (largest clique); `tSmall` covers 3.
    const mutations = [
      mutationAt(1),
      mutationAt(2),
      mutationAt(3),
      mutationAt(4),
      mutationAt(5),
      mutationAt(6),
      mutationAt(7),
      mutationAt(8),
    ]
    const testMethodsPerLine = coverage([
      [1, ['tSmall']],
      [2, ['tSmall']],
      [3, ['tSmall']],
      [4, ['tBig']],
      [5, ['tBig']],
      [6, ['tBig']],
      [7, ['tBig']],
      [8, ['tBig']],
    ])

    // Act
    const result = groupMutations(mutations, testMethodsPerLine)

    // Assert
    expect(result.lowerBound).toBe(5)
    expect(result.groups).toHaveLength(5)
  })

  it('given two mutations on the same line sharing the same test set reference when grouping then both appear in the witness as distinct vertices', () => {
    // Arrange — testMethodsPerLine returns the same Set for adjacent lookups.
    // The clique-builder must index by mutation, not by line, so both
    // mutations contribute to the witness.
    const sharedSet = new Set(['t'])
    const testMethodsPerLine = new Map<number, Set<string>>([
      [1, sharedSet],
      [2, sharedSet],
    ])
    const mutations = [mutationAt(1, 'm0'), mutationAt(2, 'm1')]

    // Act
    const result = groupMutations(mutations, testMethodsPerLine)

    // Assert
    expect(result.lowerBound).toBe(2)
    expect(result.groups).toHaveLength(2)
    expect(groupOf(result, mutations[0])).not.toBe(
      groupOf(result, mutations[1])
    )
  })

  it('given two uncolored vertices with identical (saturation, degree) when grouping then the lower input index is picked first', () => {
    // Arrange — after vertex 0 is pre-colored from the witness clique
    // (test `t01` covers indices 0 and 1), vertices 2 and 3 are both
    // uncolored, both have saturation=0 (no colored neighbors) and both
    // have degree=1. The strict-`>` tiebreak in pickNextVertex must pick
    // vertex 2 (lower input index) before vertex 3. Switching to `>=`
    // would pick vertex 3 instead — this assertion catches that mutant.
    const m0 = mutationAt(1)
    const m1 = mutationAt(2)
    const m2 = mutationAt(3)
    const m3 = mutationAt(4)
    const mutations = [m0, m1, m2, m3]
    const testMethodsPerLine = coverage([
      [1, ['t01']],
      [2, ['t01']],
      [3, ['t23']],
      [4, ['t23']],
    ])

    // Act
    const result = groupMutations(mutations, testMethodsPerLine)

    // Assert — m0 and m2 share the same color (the lowest available, 0);
    // m1 and m3 share color 1. Strict `>` keeps the lowest-index winner.
    expect(result.groups).toHaveLength(2)
    expect(groupOf(result, m0)).toBe(groupOf(result, m2))
    expect(groupOf(result, m1)).toBe(groupOf(result, m3))
    expect(groupOf(result, m0)).not.toBe(groupOf(result, m1))
  })

  it('given the same input twice when grouping then both runs produce identical results', () => {
    // Arrange
    const mutations = [
      mutationAt(1, 'a'),
      mutationAt(2, 'b'),
      mutationAt(3, 'c'),
      mutationAt(4, 'd'),
    ]
    const testMethodsPerLine = coverage([
      [1, ['t1', 't2']],
      [2, ['t2']],
      [3, ['t3']],
      [4, ['t1', 't3']],
    ])

    // Act
    const a = groupMutations(mutations, testMethodsPerLine)
    const b = groupMutations(mutations, testMethodsPerLine)

    // Assert
    expect(b.groups).toHaveLength(a.groups.length)
    expect(b.lowerBound).toBe(a.lowerBound)
    a.groups.forEach((g, i) => {
      expect(b.groups[i].mutations).toEqual(g.mutations)
      expect(b.groups[i].testMethods).toEqual(g.testMethods)
    })
  })
})
