import {
  buildAdjacency,
  decideExactOutcome,
  type SolveColoringInput,
  type SolveColoringResult,
  solveColoring,
  tryKColoring,
} from '../../../src/service/exactColoring.js'
import {
  buildMycielskiAdjacency,
  MYCIELSKI_M4_NUM_VERTICES,
} from '../fixtures/mycielski-m4.js'

const baseInput = (
  overrides: Partial<SolveColoringInput>
): SolveColoringInput => ({
  adjacency: [[]],
  n: 1,
  lowerBound: 1,
  dsaturColors: 1,
  witness: [],
  dsaturColoring: [0],
  ...overrides,
})

const isValidColoring = (
  coloring: ReadonlyArray<number>,
  adjacency: ReadonlyArray<ReadonlyArray<number>>
): boolean => {
  for (let v = 0; v < adjacency.length; ++v) {
    if (coloring[v] < 0) return false
    for (const w of adjacency[v]) {
      if (coloring[v] === coloring[w]) return false
    }
  }
  return true
}

describe('buildAdjacency', () => {
  it('given disjoint test sets when building then yields no edges', () => {
    // Arrange
    const tests = [new Set(['a']), new Set(['b']), new Set(['c'])]

    // Act
    const adj = buildAdjacency(tests)

    // Assert
    expect(adj).toEqual([[], [], []])
  })

  it('given pairwise intersecting test sets when building then yields a complete graph', () => {
    // Arrange — every pair shares the test "shared".
    const tests = [
      new Set(['shared', 'a']),
      new Set(['shared', 'b']),
      new Set(['shared', 'c']),
    ]

    // Act
    const adj = buildAdjacency(tests)

    // Assert — every vertex adjacent to every other.
    expect(adj[0].sort()).toEqual([1, 2])
    expect(adj[1].sort()).toEqual([0, 2])
    expect(adj[2].sort()).toEqual([0, 1])
  })

  it('given a small set and a large set sharing one test when building then registers the edge regardless of input order', () => {
    // Arrange — the size-asymmetric branch (small ≤ large vs the reverse).
    const big = new Set(['x', 'y', 'z', 'shared'])
    const small = new Set(['shared'])

    // Act
    const adjFirst = buildAdjacency([small, big])
    const adjReverse = buildAdjacency([big, small])

    // Assert — both orderings produce the same edge.
    expect(adjFirst[0]).toEqual([1])
    expect(adjFirst[1]).toEqual([0])
    expect(adjReverse[0]).toEqual([1])
    expect(adjReverse[1]).toEqual([0])
  })
})

describe('tryKColoring', () => {
  it('given k less than the witness clique size when called then immediately returns null', () => {
    expect(tryKColoring([[1], [0]], 2, 1, [0, 1])).toBeNull()
  })

  it('given an empty graph when called with k=1 then returns the empty coloring', () => {
    expect(tryKColoring([], 0, 1, [])).toEqual([])
  })

  it('given a triangle K_3 at k=2 when called then returns null', () => {
    // Arrange — K_3 has chromatic number 3.
    const adj: number[][] = [
      [1, 2],
      [0, 2],
      [0, 1],
    ]

    // Act
    const result = tryKColoring(adj, 3, 2, [])

    // Assert
    expect(result).toBeNull()
  })

  it('given a triangle K_3 at k=3 when called then returns a valid 3-coloring', () => {
    // Arrange
    const adj: number[][] = [
      [1, 2],
      [0, 2],
      [0, 1],
    ]

    // Act
    const result = tryKColoring(adj, 3, 3, [])

    // Assert
    expect(result).not.toBeNull()
    expect(isValidColoring(result!, adj)).toBe(true)
    expect(new Set(result!).size).toBe(3)
  })

  it('given K_4 when called with k=4 then returns SAT and with k=3 returns null', () => {
    // Arrange — complete graph on 4 vertices, χ = 4.
    const adj: number[][] = [
      [1, 2, 3],
      [0, 2, 3],
      [0, 1, 3],
      [0, 1, 2],
    ]

    // Act & Assert
    expect(tryKColoring(adj, 4, 4, [])).not.toBeNull()
    expect(tryKColoring(adj, 4, 3, [])).toBeNull()
  })

  it('given C_5 (odd cycle) when called with k=3 then returns SAT and with k=2 returns null', () => {
    // Arrange — 5-cycle, χ = 3.
    const adj: number[][] = [
      [1, 4],
      [0, 2],
      [1, 3],
      [2, 4],
      [0, 3],
    ]

    // Act
    const result = tryKColoring(adj, 5, 3, [])
    const fail = tryKColoring(adj, 5, 2, [])

    // Assert
    expect(result).not.toBeNull()
    expect(isValidColoring(result!, adj)).toBe(true)
    expect(fail).toBeNull()
  })

  it('given a witness clique seed when called then the witness vertices keep their forced colors', () => {
    // Arrange — K_3 with witness [0, 1, 2] forced to colors 0, 1, 2.
    const adj: number[][] = [
      [1, 2],
      [0, 2],
      [0, 1],
    ]

    // Act
    const result = tryKColoring(adj, 3, 3, [0, 1, 2])

    // Assert
    expect(result).toEqual([0, 1, 2])
  })

  it('given Mycielski M_4 when called with k=4 then returns a valid 4-coloring', () => {
    // Arrange — M_4 has chromatic number 4 but ω = 2 (triangle-free).
    const adj = buildMycielskiAdjacency()

    // Act
    const result = tryKColoring(adj, MYCIELSKI_M4_NUM_VERTICES, 4, [])

    // Assert
    expect(result).not.toBeNull()
    expect(isValidColoring(result!, adj)).toBe(true)
    expect(new Set(result!).size).toBeLessThanOrEqual(4)
  })

  it('given Mycielski M_4 when called with k=3 then returns null', () => {
    // Arrange
    const adj = buildMycielskiAdjacency()

    // Act
    const result = tryKColoring(adj, MYCIELSKI_M4_NUM_VERTICES, 3, [])

    // Assert
    expect(result).toBeNull()
  })

  it('given K_3 at k=2 with a witness that consumes both colors when called then the early-exit `used.size >= k` guard fires', () => {
    // Arrange — K_3 with witness pre-coloring vertices 0 and 1 with the
    // only two available colors. The remaining vertex 2 has both neighbors
    // covered by distinct colors, so its used-set is full at backtrack
    // entry. Exercises the post-forward-check early-exit.
    const adj: number[][] = [
      [1, 2],
      [0, 2],
      [0, 1],
    ]

    // Act
    const result = tryKColoring(adj, 3, 2, [0, 1])

    // Assert
    expect(result).toBeNull()
  })

  it('given K_4 at k=3 when called then forward checking detects the strand at depth 3 and returns null', () => {
    // Arrange — K_4 has chromatic number 4. With k=3, after coloring any
    // three vertices with three distinct colors (forced — they form a
    // triangle), the fourth vertex is stranded: every color appears on one
    // of its three colored neighbors. Forward checking catches this strand
    // when the third color is assigned, without recursing into the fourth
    // pick. The test asserts the public contract: returns null with no
    // crash, regardless of internal pruning depth.
    const adj: number[][] = [
      [1, 2, 3],
      [0, 2, 3],
      [0, 1, 3],
      [0, 1, 2],
    ]

    // Act
    const result = tryKColoring(adj, 4, 3, [])

    // Assert
    expect(result).toBeNull()
  })

  it('given a star where every neighbor of a single hub is independent when called with k=2 then returns a valid 2-coloring', () => {
    // Arrange — exercises the saturation tiebreak: after coloring the hub,
    // every spoke has saturation=1, degree=1, so input order is the final
    // tiebreak. All spokes must take color 1.
    const adj: number[][] = [
      [1, 2, 3], // hub
      [0],
      [0],
      [0],
    ]

    // Act
    const result = tryKColoring(adj, 4, 2, [])

    // Assert
    expect(result).not.toBeNull()
    expect(isValidColoring(result!, adj)).toBe(true)
    expect(new Set(result!).size).toBe(2)
  })
})

describe('solveColoring', () => {
  it('given dsaturColors == lowerBound when solving then returns DSATUR coloring as optimal', () => {
    // Arrange — the loop never enters because lo == hi.
    const result = solveColoring(
      baseInput({
        adjacency: [[]],
        n: 1,
        lowerBound: 1,
        dsaturColors: 1,
        dsaturColoring: [0],
      })
    )

    // Assert
    expect(result.optimal).toBe(true)
    expect(result.coloring).toEqual([0])
    expect(result.lowerBound).toBe(1)
  })

  it('given a triangle K_3 when solving then proves chi = 3 and returns a valid coloring', () => {
    // Arrange — K_3 has lowerBound = 2 (any pair conflicts) but chi = 3.
    const adjacency: number[][] = [
      [1, 2],
      [0, 2],
      [0, 1],
    ]

    // Act
    const result = solveColoring({
      adjacency,
      n: 3,
      lowerBound: 2,
      dsaturColors: 3,
      witness: [],
      dsaturColoring: [0, 1, 2],
    })

    // Assert
    expect(result.optimal).toBe(true)
    expect(result.lowerBound).toBe(3)
    expect(isValidColoring(result.coloring, adjacency)).toBe(true)
    expect(new Set(result.coloring).size).toBe(3)
  })

  it('given a graph where DSATUR overshoots when solving then exact lowers the color count', () => {
    // Arrange — a triangle but DSATUR claims 4 colors. Exact must drop to 3.
    const adjacency: number[][] = [
      [1, 2],
      [0, 2],
      [0, 1],
    ]

    // Act
    const result = solveColoring({
      adjacency,
      n: 3,
      lowerBound: 2,
      dsaturColors: 4,
      witness: [],
      dsaturColoring: [0, 1, 2],
    })

    // Assert
    expect(new Set(result.coloring).size).toBe(3)
    expect(result.optimal).toBe(true)
  })

  it('given a Mycielski M_4 instance with a gap when solving then proves chi = 4', () => {
    // Arrange — pretend DSATUR returned 5 colors (the adversarial case);
    // exact must prove chi = 4.
    const adjacency = buildMycielskiAdjacency()

    // Act
    const result = solveColoring({
      adjacency,
      n: MYCIELSKI_M4_NUM_VERTICES,
      lowerBound: 2,
      dsaturColors: 5,
      witness: [],
      dsaturColoring: [0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 4],
    })

    // Assert
    expect(result.optimal).toBe(true)
    expect(result.lowerBound).toBe(4)
    expect(new Set(result.coloring).size).toBeLessThanOrEqual(4)
    expect(isValidColoring(result.coloring, adjacency)).toBe(true)
  })

  it('given lowerBound below witness size when solving then throws', () => {
    expect(() =>
      solveColoring(
        baseInput({
          witness: [0, 1],
          lowerBound: 1,
        })
      )
    ).toThrow(/below witness size/)
  })

  it('given lo+hi is odd when binary searching then picks floor((lo+hi)/2) — kills the floor→ceil mutant', () => {
    // Arrange — Mycielski M_4 has chromatic number 4. With lowerBound 2
    // and dsaturColors 5, the first k must be floor((2+5)/2) = 3. With chi=4,
    // k=3 is UNSAT, so lo jumps to 4. Then k = floor((4+5)/2) = 4, which is
    // SAT (chi=4). Final lowerBound = 4. A `ceil` mutant would pick k=4
    // first, which is SAT straight away — final lowerBound stays at 2 (no
    // UNSAT raised it).
    const adjacency = buildMycielskiAdjacency()

    // Act
    const result = solveColoring({
      adjacency,
      n: MYCIELSKI_M4_NUM_VERTICES,
      lowerBound: 2,
      dsaturColors: 5,
      witness: [],
      dsaturColoring: [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0],
    })

    // Assert
    expect(result.lowerBound).toBe(4)
    expect(result.optimal).toBe(true)
  })

  it('given lowerBound above dsaturColors when solving then reports the result as not optimal', () => {
    // Arrange — the only shape where the binary search never runs and lo
    // overshoots hi, so `lo === hi` is genuinely false rather than trivially true.
    const result = solveColoring(
      baseInput({ lowerBound: 5, dsaturColors: 3, dsaturColoring: [0] })
    )

    // Assert
    expect(result.optimal).toBe(false)
    expect(result.lowerBound).toBe(5)
  })

  it('given the DSATUR coloring is kept when solving then the returned coloring is a defensive copy', () => {
    // Arrange — `best` seeds from `dsaturColoring.slice()`; returning the
    // caller's own array would let a later mutation leak into the result.
    const dsaturColoring = [0]

    // Act
    const result = solveColoring(baseInput({ dsaturColoring }))

    // Assert
    expect(result.coloring).toEqual(dsaturColoring)
    expect(result.coloring).not.toBe(dsaturColoring)
  })
})

describe('tryKColoring — DSATUR selection is deterministic', () => {
  // The selection order is a documented contract: highest saturation, then
  // highest degree, then lowest input index. Asserting only validity lets any
  // permutation of that order pass, so these assert the exact coloring.

  it('given a path P4 when 2-coloring then the interior vertices are picked before the endpoints', () => {
    // Arrange — all saturations start at 0, so the first pick is decided purely
    // by degree: vertex 1 (degree 2) outranks vertex 0 (degree 1). Colouring in
    // input order instead would yield [0,1,0,1].
    const adjacency: number[][] = [[1], [0, 2], [1, 3], [2]]

    // Act
    const result = tryKColoring(adjacency, 4, 2, [])

    // Assert
    expect(result).toEqual([1, 0, 1, 0])
  })

  it('given a bull graph when 3-coloring then saturation outranks degree in the pick order', () => {
    // Arrange — the triangle 0-1-2 carries the horns 3 and 4. Once the triangle
    // is coloured the horns are saturated differently, so the exact assignment
    // pins both the saturation and the degree tiebreak.
    const adjacency: number[][] = [[1, 2], [0, 2, 3], [0, 1, 4], [1], [2]]

    // Act
    const result = tryKColoring(adjacency, 5, 3, [])

    // Assert
    expect(result).toEqual([2, 0, 1, 1, 0])
  })

  it('given an odd cycle C5 when 3-coloring then the third color lands on the last vertex', () => {
    // Arrange — C_5 is not 2-colorable; walking the cycle greedily forces the
    // extra color onto vertex 4.
    const adjacency: number[][] = [
      [1, 4],
      [0, 2],
      [1, 3],
      [2, 4],
      [3, 0],
    ]

    // Act
    const result = tryKColoring(adjacency, 5, 3, [])

    // Assert
    expect(result).toEqual([0, 1, 0, 1, 2])
  })

  it('given a later vertex with strictly higher saturation when picking then it outranks an earlier higher-degree vertex', () => {
    // Arrange — with vertex 0 seeded, vertex 4 reaches a strictly higher
    // saturation than the current pick while having no degree advantage. Only a
    // genuine `saturation > pickSaturation` test promotes it; folding that test
    // into the `pick === -1` clause (or dropping it) re-orders the search and
    // lands vertex 4 on a different color.
    const adjacency: number[][] = [
      [1, 2, 3],
      [0, 3, 5],
      [0, 3],
      [0, 1, 2],
      [5],
      [1, 4],
    ]

    // Act
    const result = tryKColoring(adjacency, 6, 4, [0])

    // Assert
    expect(result).toEqual([0, 1, 1, 2, 1, 0])
  })

  it('given saturation ties broken by degree when picking then equal saturation is required, not assumed', () => {
    // Arrange — treating every saturation comparison as a tie hands the pick to
    // whichever vertex has the highest degree regardless of constraint, which
    // re-colors most of the graph.
    const adjacency: number[][] = [
      [2, 5],
      [3, 4],
      [0, 3],
      [1, 2, 6],
      [1, 6],
      [0],
      [3, 4],
    ]

    // Act
    const result = tryKColoring(adjacency, 7, 3, [5])

    // Assert
    expect(result).toEqual([1, 0, 0, 1, 1, 0, 0])
  })

  it('given a vertex with both colored and uncolored neighbors when 2-coloring then uncolored neighbors are excluded from the used set', () => {
    // Arrange — vertex 3 is picked while neighbor 2 is still uncolored. Counting
    // the sentinel -1 as a used color inflates the set to size 2, tripping the
    // `used.size >= k` early exit and failing a graph that is plainly 2-colorable.
    const adjacency: number[][] = [[4], [], [3, 5], [2, 4], [0, 3], [2]]

    // Act
    const result = tryKColoring(adjacency, 6, 2, [])

    // Assert
    expect(result).toEqual([1, 0, 0, 1, 0, 1])
  })

  it('given a branch that fails below the forward-checking horizon when coloring then the next color is tried', () => {
    // Arrange — a dense 10-vertex graph at k=4. Forward checking clears the
    // first color for some vertex, yet the search below it still dead-ends, so
    // the recursion must fall through and try the next color. Returning the
    // failed recursion verbatim abandons the search and yields null.
    const adjacency: number[][] = [
      [3, 6, 8, 9],
      [2, 3, 5, 8],
      [1, 3, 6, 7, 8],
      [0, 1, 2, 4, 6, 9],
      [3, 5, 6],
      [1, 4, 6, 7, 8, 9],
      [0, 2, 3, 4, 5, 7, 8, 9],
      [2, 5, 6, 9],
      [0, 1, 2, 5, 6],
      [0, 3, 5, 6, 7],
    ]

    // Act
    const result = tryKColoring(adjacency, 10, 4, [9])

    // Assert
    expect(result).toEqual([3, 1, 0, 2, 0, 3, 1, 2, 2, 0])
    expect(isValidColoring(result as number[], adjacency)).toBe(true)
  })

  it('given a witness clique when 3-coloring then witness vertices keep their seeded colors in witness order', () => {
    // Arrange — the witness is pre-coloured by position, not by vertex id:
    // witness[0]=2 takes color 0 and witness[1]=0 takes color 1, leaving
    // vertex 1 to fill the remaining color.
    const adjacency: number[][] = [
      [1, 2],
      [0, 2],
      [0, 1],
    ]

    // Act
    const result = tryKColoring(adjacency, 3, 3, [2, 0])

    // Assert
    expect(result).toEqual([1, 2, 0])
  })
})

describe('decideExactOutcome', () => {
  const baseExact = (
    overrides: Partial<SolveColoringResult>
  ): SolveColoringResult => ({
    coloring: [0, 1],
    lowerBound: 2,
    optimal: true,
    ...overrides,
  })

  it('given an exact result with strictly fewer colors than DSATUR when deciding then prefers exact with the improved suffix', () => {
    // Asymmetric coloring `[2, 0, 1]` ensures the running max walks up and
    // down — kills the `(c > m ? c : m)` → `(c < m ? c : m)` mutant.
    const decision = decideExactOutcome(baseExact({ coloring: [2, 0, 1] }), 4)
    expect(decision).toEqual({
      useGroups: 'exact',
      suffix: ' — exact: improved by 1 deploy(s)',
    })
  })

  it('given an exact result with the same color count as DSATUR when deciding then keeps DSATUR with the confirmed-optimal suffix', () => {
    const decision = decideExactOutcome(baseExact({ coloring: [0, 1] }), 2)
    expect(decision).toEqual({
      useGroups: 'dsatur',
      suffix: ' — exact: confirmed optimal',
    })
  })
})
