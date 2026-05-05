// Exact graph k-coloring via DSATUR-style backtracking. Pure TypeScript,
// no external SAT solver — at our scale (n ≤ 200) the witness clique
// from D2 already fixes the most-constrained vertices, so the backtracking
// search converges fast on real Apex graphs.

// Build the conflict-graph adjacency list. Vertex i and j are adjacent iff
// `tests(i) ∩ tests(j) ≠ ∅`. Same definition as in mutationGrouper; lives
// here so the exact-coloring driver and the DSATUR driver share one source
// of truth.
export const buildAdjacency = (
  tests: ReadonlyArray<Set<string>>
): number[][] => {
  const n = tests.length
  const adjacency: number[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; ++i) {
    for (let j = i + 1; j < n; ++j) {
      if (intersects(tests[i], tests[j])) {
        adjacency[i].push(j)
        adjacency[j].push(i)
      }
    }
  }
  return adjacency
}

const intersects = (a: Set<string>, b: Set<string>): boolean => {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  for (const t of small) {
    if (large.has(t)) return true
  }
  return false
}

// Decide whether the graph admits a valid k-coloring; return one if it does,
// `null` otherwise. Pre-colors the witness clique (whose vertices must
// receive distinct colors in any valid coloring), then runs DSATUR-style
// backtracking on the remaining vertices: at each step, pick the most
// constrained uncolored vertex (highest saturation, then highest degree,
// then lowest input index) and try the smallest available color first.
export const tryKColoring = (
  adjacency: ReadonlyArray<ReadonlyArray<number>>,
  n: number,
  k: number,
  witness: ReadonlyArray<number>
): number[] | null => {
  if (k < witness.length) return null
  const color = new Array<number>(n).fill(-1)
  for (let i = 0; i < witness.length; ++i) color[witness[i]] = i
  const degree = adjacency.map(neighbors => neighbors.length)
  return backtrack(adjacency, n, k, color, degree)
}

const backtrack = (
  adjacency: ReadonlyArray<ReadonlyArray<number>>,
  n: number,
  k: number,
  color: number[],
  degree: ReadonlyArray<number>
): number[] | null => {
  const v = pickMostConstrained(adjacency, color, degree)
  if (v === -1) return color.slice()

  const used = neighborColors(adjacency[v], color)
  if (used.size >= k) return null

  for (let c = 0; c < k; ++c) {
    if (used.has(c)) continue
    color[v] = c
    // Forward checking: skip the recurse if assigning c to v would strand
    // some uncolored neighbor (no color left for it). Catches the dead end
    // one level earlier, dodging an entire `pickMostConstrained` scan.
    if (!wouldStrandNeighbor(adjacency, color, v, k)) {
      const result = backtrack(adjacency, n, k, color, degree)
      if (result !== null) return result
    }
  }
  color[v] = -1
  return null
}

// True iff some uncolored neighbor of `v` now has zero available colors —
// i.e. every color in [0, k) appears on one of its colored neighbors.
const wouldStrandNeighbor = (
  adjacency: ReadonlyArray<ReadonlyArray<number>>,
  color: ReadonlyArray<number>,
  v: number,
  k: number
): boolean => {
  for (const u of adjacency[v]) {
    if (color[u] !== -1) continue
    if (neighborColors(adjacency[u], color).size >= k) return true
  }
  return false
}

// DSATUR vertex selection: highest saturation (number of distinct neighbor
// colors), tiebreak on degree, tiebreak on input index. Strict `>`
// comparisons keep the lowest unprocessed index winning ties — same
// determinism contract as `mutationGrouper.pickNextVertex`.
const pickMostConstrained = (
  adjacency: ReadonlyArray<ReadonlyArray<number>>,
  color: ReadonlyArray<number>,
  degree: ReadonlyArray<number>
): number => {
  let pick = -1
  let pickSaturation = -1
  for (let v = 0; v < color.length; ++v) {
    if (color[v] !== -1) continue
    const saturation = neighborColors(adjacency[v], color).size
    if (
      pick === -1 ||
      saturation > pickSaturation ||
      (saturation === pickSaturation && degree[v] > degree[pick])
    ) {
      pick = v
      pickSaturation = saturation
    }
  }
  return pick
}

const neighborColors = (
  neighbors: ReadonlyArray<number>,
  color: ReadonlyArray<number>
): Set<number> => {
  const used = new Set<number>()
  for (const u of neighbors) {
    if (color[u] !== -1) used.add(color[u])
  }
  return used
}

export type SolveColoringInput = {
  adjacency: ReadonlyArray<ReadonlyArray<number>>
  n: number
  lowerBound: number
  dsaturColors: number
  witness: ReadonlyArray<number>
  dsaturColoring: ReadonlyArray<number>
}

export type SolveColoringResult = {
  coloring: ReadonlyArray<number>
  lowerBound: number
  optimal: boolean
}

// Maps an exact-coloring outcome to (a) the groups to use downstream and
// (b) a human-readable suffix appended to `info.groupingPlan`. Pure
// function — the caller decides whether to call `assembleGroups` based on
// the `useGroups` discriminator.
type ExactDecision =
  | { useGroups: 'exact'; suffix: string }
  | { useGroups: 'dsatur'; suffix: string }

export const decideExactOutcome = (
  exact: SolveColoringResult,
  dsaturColors: number
): ExactDecision => {
  const exactColors = exact.coloring.reduce((m, c) => (c > m ? c : m), -1) + 1
  if (exactColors < dsaturColors) {
    return {
      useGroups: 'exact',
      suffix: ` — exact: improved by ${dsaturColors - exactColors} deploy(s)`,
    }
  }
  return { useGroups: 'dsatur', suffix: ' — exact: confirmed optimal' }
}

// Binary search on k = chromatic number, using `tryKColoring` to certify
// or improve the DSATUR result. Runs every iteration to completion. The
// loop exits when lo == hi (provably optimal). Result is never worse than
// DSATUR alone.
export const solveColoring = (
  input: SolveColoringInput
): SolveColoringResult => {
  const { adjacency, n, dsaturColors, witness, dsaturColoring } = input
  const initialLowerBound = input.lowerBound
  if (initialLowerBound < witness.length) {
    throw new Error(
      `solveColoring: lowerBound=${initialLowerBound} is below witness size ${witness.length}`
    )
  }

  let lo = initialLowerBound
  let hi = dsaturColors
  let best: ReadonlyArray<number> = dsaturColoring.slice()

  while (lo < hi) {
    const k = Math.floor((lo + hi) / 2)
    const coloring = tryKColoring(adjacency, n, k, witness)
    if (coloring !== null) {
      best = coloring
      hi = k
    } else {
      lo = k + 1
    }
  }

  return { coloring: best, lowerBound: lo, optimal: lo === hi }
}
