import { DSaturGrouper } from '../../../../src/service/groupers/dsaturGrouper.js'
import {
  coverage,
  everyMutationAppearsExactlyOnce,
  mutationAt,
  noGroupHasInternalConflict,
} from './grouperTestFixtures.js'

describe('DSaturGrouper', () => {
  let sut: DSaturGrouper

  beforeEach(() => {
    sut = new DSaturGrouper()
  })

  describe('group', () => {
    it('given empty mutations when grouping then returns no groups', () => {
      // Arrange & Act
      const result = sut.group({
        mutations: [],
        testMethodsPerLine: coverage([]),
      })

      // Assert
      expect(result).toEqual([])
    })

    it('given a single mutation when grouping then returns one group of size 1', () => {
      // Arrange
      const mutations = [mutationAt(1)]
      const testMethodsPerLine = coverage([[1, ['t1']]])

      // Act
      const result = sut.group({ mutations, testMethodsPerLine })

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].mutations).toEqual(mutations)
      expect(result[0].testMethods).toEqual(new Set(['t1']))
    })

    it('given two mutations with disjoint tests when grouping then merges into one group', () => {
      // Arrange
      const mutations = [mutationAt(1), mutationAt(2)]
      const testMethodsPerLine = coverage([
        [1, ['t1']],
        [2, ['t2']],
      ])

      // Act
      const result = sut.group({ mutations, testMethodsPerLine })

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].testMethods).toEqual(new Set(['t1', 't2']))
    })

    it('given two mutations sharing a test when grouping then keeps them apart', () => {
      // Arrange
      const mutations = [mutationAt(1), mutationAt(2)]
      const testMethodsPerLine = coverage([
        [1, ['shared']],
        [2, ['shared']],
      ])

      // Act
      const result = sut.group({ mutations, testMethodsPerLine })

      // Assert
      expect(result).toHaveLength(2)
    })

    it('given a triangle of conflicts when grouping then returns three singleton groups', () => {
      // Arrange — every pair shares a test
      const mutations = [mutationAt(1), mutationAt(2), mutationAt(3)]
      const testMethodsPerLine = coverage([
        [1, ['t12', 't13']],
        [2, ['t12', 't23']],
        [3, ['t13', 't23']],
      ])

      // Act
      const result = sut.group({ mutations, testMethodsPerLine })

      // Assert
      expect(result).toHaveLength(3)
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
      const result = sut.group({ mutations, testMethodsPerLine })

      // Assert
      expect(result).toHaveLength(1)
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
      const result = sut.group({ mutations, testMethodsPerLine })

      // Assert
      expect(result).toHaveLength(2)
      expect(noGroupHasInternalConflict(result, testMethodsPerLine)).toBe(true)
    })

    it('given a complete bipartite graph K(3,3) when grouping then returns the optimal 2 groups', () => {
      // Arrange — A-side {1,2,3} vs B-side {4,5,6}; cross-edges via xij tests; no within-side overlap.
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
      const result = sut.group({ mutations, testMethodsPerLine })

      // Assert — DSATUR is provably optimal on bipartite graphs (χ = 2)
      expect(result).toHaveLength(2)
      expect(result.every(g => g.mutations.length === 3)).toBe(true)
      expect(noGroupHasInternalConflict(result, testMethodsPerLine)).toBe(true)
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
      const result = sut.group({ mutations, testMethodsPerLine })

      // Assert
      expect(everyMutationAppearsExactlyOnce(result, mutations)).toBe(true)
      expect(noGroupHasInternalConflict(result, testMethodsPerLine)).toBe(true)
    })

    it('given mutations with no covering tests when grouping then they all merge into one group', () => {
      // Arrange — empty test sets never conflict with anything
      const mutations = [mutationAt(1), mutationAt(2), mutationAt(3)]
      const testMethodsPerLine = coverage([])

      // Act
      const result = sut.group({ mutations, testMethodsPerLine })

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].mutations).toHaveLength(3)
    })
  })
})
