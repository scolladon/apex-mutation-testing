import { ApexMutation } from '../../type/ApexMutation.js'
import {
  conflicts,
  GrouperInput,
  MutationGroup,
  MutationGrouper,
  testsForMutation,
} from '../mutationGrouper.js'

interface MutableGroup {
  mutations: ApexMutation[]
  testMethods: Set<string>
}

/**
 * DSATUR (Brélaz, 1979): the strongest polynomial-time graph-coloring
 * heuristic. At each step, color the uncolored vertex whose **saturation**
 * (count of distinct colors already used by its colored neighbors) is highest;
 * tiebreak on raw degree, then input order. Provably optimal on bipartite
 * graphs and several other structured classes; near-optimal on the rest.
 *
 * Each color = one batched deployment + one batched test run.
 */
export class DSaturGrouper implements MutationGrouper {
  public group(input: GrouperInput): MutationGroup[] {
    const { mutations, testMethodsPerLine } = input
    const n = mutations.length
    if (n === 0) return []

    const tests = mutations.map(m => testsForMutation(m, testMethodsPerLine))
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
  const groups: MutableGroup[] = []
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
