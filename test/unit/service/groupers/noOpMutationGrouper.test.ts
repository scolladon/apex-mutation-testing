import { NoOpMutationGrouper } from '../../../../src/service/groupers/noOpMutationGrouper.js'
import {
  coverage,
  everyMutationAppearsExactlyOnce,
  mutationAt,
} from './grouperTestFixtures.js'

describe('NoOpMutationGrouper', () => {
  let sut: NoOpMutationGrouper

  beforeEach(() => {
    sut = new NoOpMutationGrouper()
  })

  describe('group', () => {
    it('given empty mutations when grouping then returns no groups', () => {
      // Arrange
      const input = { mutations: [], testMethodsPerLine: coverage([]) }

      // Act
      const result = sut.group(input)

      // Assert
      expect(result).toEqual([])
    })

    it('given N mutations when grouping then returns N groups of size 1', () => {
      // Arrange
      const mutations = [mutationAt(1), mutationAt(2), mutationAt(3)]
      const testMethodsPerLine = coverage([
        [1, ['t1']],
        [2, ['t1']],
        [3, ['t1']],
      ])

      // Act
      const result = sut.group({ mutations, testMethodsPerLine })

      // Assert
      expect(result).toHaveLength(mutations.length)
      expect(result.every(g => g.mutations.length === 1)).toBe(true)
      expect(everyMutationAppearsExactlyOnce(result, mutations)).toBe(true)
    })

    it('given a mutation when grouping then attaches its test methods', () => {
      // Arrange
      const mutations = [mutationAt(7)]
      const testMethodsPerLine = coverage([[7, ['ta', 'tb']]])

      // Act
      const result = sut.group({ mutations, testMethodsPerLine })

      // Assert
      expect(result[0].testMethods).toEqual(new Set(['ta', 'tb']))
    })
  })
})
