import { ApexMutation } from '../type/ApexMutation.js'
import { buildAdjacency } from './exactColoring.js'

export interface MutationGroup {
  mutations: ApexMutation[]
  testMethods: Set<string>
}

export interface GroupingResult {
  groups: MutationGroup[]
  lowerBound: number
}

interface GroupingInternals {
  adjacency: number[][]
  witness: number[]
  coloring: number[]
  tests: ReadonlyArray<Set<string>>
}

type GroupingResultWithInternals = GroupingResult & {
  internals: GroupingInternals
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
//
// The conflict graph is the intersection graph of per-mutation test sets:
// every test method T induces a clique among the mutations it covers. The
// largest such test-induced set is a free lower bound on the chromatic
// number; pre-coloring it before DSATUR runs both gives the heuristic a
// maximally-constrained start and surfaces an optimality certificate
// (groups.length === lowerBound implies provably optimal).
export const groupMutations = (
  mutations: ReadonlyArray<ApexMutation>,
  testMethodsPerLine: Map<number, Set<string>>
): GroupingResult => {
  const { groups, lowerBound } = groupMutationsWithInternals(
    mutations,
    testMethodsPerLine
  )
  return { groups, lowerBound }
}

// Like `groupMutations` but additionally exposes the conflict graph, witness
// clique, DSATUR coloring, and per-mutation test sets. Used by the optional
// SAT-based exact-coloring path so it can re-use the work without rebuilding
// the graph.
export const groupMutationsWithInternals = (
  mutations: ReadonlyArray<ApexMutation>,
  testMethodsPerLine: Map<number, Set<string>>
): GroupingResultWithInternals => {
  const n = mutations.length
  if (n === 0) {
    return {
      groups: [],
      lowerBound: 0,
      internals: { adjacency: [], witness: [], coloring: [], tests: [] },
    }
  }

  const tests = mutations.map(
    m => testMethodsPerLine.get(m.target.startToken.line) ?? new Set<string>()
  )
  const adjacency = buildAdjacency(tests)
  const degree = adjacency.map(neighbors => neighbors.length)
  const witness = computeLowerBoundClique(tests)

  const color = new Array<number>(n).fill(-1)
  const saturation = new Array<number>(n).fill(0)
  const neighborColors: Array<Set<number>> = Array.from(
    { length: n },
    () => new Set()
  )

  for (let k = 0; k < witness.length; ++k) {
    const v = witness[k]
    color[v] = k
    propagate(v, k, adjacency, color, neighborColors, saturation)
  }

  for (let step = 0; step < n - witness.length; ++step) {
    const pick = pickNextVertex(color, saturation, degree)
    const chosenColor = pickSmallestAvailableColor(neighborColors[pick])
    color[pick] = chosenColor
    propagate(pick, chosenColor, adjacency, color, neighborColors, saturation)
  }

  return {
    groups: assembleGroups(mutations, tests, color),
    lowerBound: witness.length,
    internals: { adjacency, witness, coloring: color, tests },
  }
}

// Returns the indices of the largest test-induced clique. Each test method T
// induces a clique among {m : T ∈ tests(m)}; we pick the largest such bucket.
// O(n · k) where k = avg tests per mutation. Indexes by mutation (not by
// line) so two mutations sharing the same Set reference still produce two
// distinct witness entries.
const computeLowerBoundClique = (
  tests: ReadonlyArray<Set<string>>
): number[] => {
  const testToMutations = new Map<string, number[]>()
  for (let i = 0; i < tests.length; ++i) {
    for (const t of tests[i]) {
      const bucket = testToMutations.get(t)
      if (bucket === undefined) testToMutations.set(t, [i])
      else bucket.push(i)
    }
  }
  let best: number[] = []
  for (const indices of testToMutations.values()) {
    if (indices.length > best.length) best = indices
  }
  // Stable canonical order: ascending by mutation index. Combined with the
  // strict-`>` tiebreak in pickNextVertex, makes the entire pipeline
  // deterministic for fixed input.
  return best.slice().sort((a, b) => a - b)
}

const propagate = (
  v: number,
  c: number,
  adjacency: ReadonlyArray<ReadonlyArray<number>>,
  color: ReadonlyArray<number>,
  neighborColors: ReadonlyArray<Set<number>>,
  saturation: number[]
): void => {
  for (const neighbor of adjacency[v]) {
    if (color[neighbor] === -1 && !neighborColors[neighbor].has(c)) {
      neighborColors[neighbor].add(c)
      ++saturation[neighbor]
    }
  }
}

// Strict `>` comparisons mean equal-key candidates retain the first-encountered
// pick — which is the lowest unprocessed index. Switching to `>=` would
// silently invert determinism on every tied pair; keep the contract.
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

export const assembleGroups = (
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
