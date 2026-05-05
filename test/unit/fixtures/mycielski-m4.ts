// Canonical Mycielskian M₄ — 11 vertices, 20 edges, χ = 4, ω = 2.
// This is the smallest triangle-free graph requiring 4 colors and is the
// classic adversary for greedy coloring heuristics: DSATUR can return 5
// colors on adversarial vertex orderings while the chromatic number is
// provably 4. Construction: take C₅ on v_0..v_4, add a "shadow" u_i for
// each v_i connected to v_{i±1 mod 5}, and add a single hub w connected
// to every u_i.
//
// Vertex labelling (input index = position in this array):
//   0..4  : v_0..v_4   (the inner 5-cycle)
//   5..9  : u_0..u_4   (shadows)
//   10    : w          (hub)

export const MYCIELSKI_M4_NUM_VERTICES = 11

// Vertex index helpers (so the edge list below doesn't need to memorize the layout).
const v = (i: number): number => i // v_0..v_4 ⇒ 0..4
const u = (i: number): number => 5 + i // u_0..u_4 ⇒ 5..9
const w = 10

const MYCIELSKI_M4_EDGES: ReadonlyArray<[number, number]> = [
  // Inner cycle C₅ on v_0..v_4 (5 edges)
  [v(0), v(1)],
  [v(1), v(2)],
  [v(2), v(3)],
  [v(3), v(4)],
  [v(4), v(0)],
  // Shadows u_i connect to v_{i±1 mod 5} (10 edges)
  [u(0), v(1)],
  [u(0), v(4)],
  [u(1), v(0)],
  [u(1), v(2)],
  [u(2), v(1)],
  [u(2), v(3)],
  [u(3), v(2)],
  [u(3), v(4)],
  [u(4), v(3)],
  [u(4), v(0)],
  // Hub w connects to every u_i (5 edges)
  [w, u(0)],
  [w, u(1)],
  [w, u(2)],
  [w, u(3)],
  [w, u(4)],
]

// Build an adjacency list from the edge list.
export const buildMycielskiAdjacency = (): number[][] => {
  const adj: number[][] = Array.from(
    { length: MYCIELSKI_M4_NUM_VERTICES },
    () => []
  )
  for (const [a, b] of MYCIELSKI_M4_EDGES) {
    adj[a].push(b)
    adj[b].push(a)
  }
  return adj
}
