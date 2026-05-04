import { ApexMutation } from '../type/ApexMutation.js'

export interface MutationGroup {
  mutations: ApexMutation[]
  testMethods: Set<string>
}

const conflicts = (a: Set<string>, b: Set<string>): boolean => {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  for (const t of small) {
    if (large.has(t)) return true
  }
  return false
}

// Partition mutations into the smallest number of conflict-free groups using
// DSATUR (Brélaz, 1979): the strongest polynomial-time graph-coloring
// heuristic. At each step, color the uncolored vertex whose **saturation**
// (count of distinct colors already used by its colored neighbors) is highest;
// tiebreak on raw degree, then input order. Provably optimal on bipartite
// graphs and several other structured classes; near-optimal on the rest.
//
// Each color = one batched deployment + one batched test run. Two mutations
// share a color iff their covering tests are pairwise disjoint, so test
// outcomes can be reverse-mapped per mutation without ambiguity.
export const groupMutations = (
  mutations: ReadonlyArray<ApexMutation>,
  testMethodsPerLine: Map<number, Set<string>>
): MutationGroup[] => {
  const n = mutations.length
  if (n === 0) return []

  const tests = mutations.map(
    m => testMethodsPerLine.get(m.target.startToken.line) ?? new Set<string>()
  )
  const adjacency = buildAdjacency(tests)
  const degree = adjacency.map(neighbors => neighbors.length)

  const color = new Array<number>(n).fill(-1)
  const saturation = new Array<number>(n).fill(0)
  const neighborColors: Array<Set<number>> = Array.from(
    { length: n },
    () => new Set()
  )

  for (let step = 0; step < n; ++step) {
    const pick = pickNextVertex(color, saturation, degree)
    const chosenColor = pickSmallestAvailableColor(neighborColors[pick])
    color[pick] = chosenColor

    for (const neighbor of adjacency[pick]) {
      if (
        color[neighbor] === -1 &&
        !neighborColors[neighbor].has(chosenColor)
      ) {
        neighborColors[neighbor].add(chosenColor)
        ++saturation[neighbor]
      }
    }
  }

  return assembleGroups(mutations, tests, color)
}

const buildAdjacency = (tests: ReadonlyArray<Set<string>>): number[][] => {
  const n = tests.length
  const adjacency: number[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; ++i) {
    for (let j = i + 1; j < n; ++j) {
      if (conflicts(tests[i], tests[j])) {
        adjacency[i].push(j)
        adjacency[j].push(i)
      }
    }
  }
  return adjacency
}

const pickNextVertex = (
  color: ReadonlyArray<number>,
  saturation: ReadonlyArray<number>,
  degree: ReadonlyArray<number>
): number => {
  let pick = -1
  for (let i = 0; i < color.length; ++i) {
    if (color[i] !== -1) continue
    if (
      pick === -1 ||
      saturation[i] > saturation[pick] ||
      (saturation[i] === saturation[pick] && degree[i] > degree[pick])
    ) {
      pick = i
    }
  }
  return pick
}

const pickSmallestAvailableColor = (
  neighborColors: ReadonlySet<number>
): number => {
  let candidate = 0
  while (neighborColors.has(candidate)) {
    ++candidate
  }
  return candidate
}

const assembleGroups = (
  mutations: ReadonlyArray<ApexMutation>,
  tests: ReadonlyArray<Set<string>>,
  color: ReadonlyArray<number>
): MutationGroup[] => {
  const groups: MutationGroup[] = []
  for (let i = 0; i < mutations.length; ++i) {
    const c = color[i]
    while (groups.length <= c) {
      groups.push({ mutations: [], testMethods: new Set() })
    }
    groups[c].mutations.push(mutations[i])
    for (const t of tests[i]) groups[c].testMethods.add(t)
  }
  return groups
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
