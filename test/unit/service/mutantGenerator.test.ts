import { MutantGenerator } from '../../../src/service/mutantGenerator.js'

describe('MutantGenerator', () => {
  let sut: MutantGenerator

  beforeEach(() => {
    sut = new MutantGenerator()
  })

  describe('when computing mutations', () => {
    it('should return mutations for increment operator on covered lines', () => {
      // Arrange
      const classContent =
        'public class Test { public static void method() { integer i = 0; ++i; } }'
      const coveredLines = new Set([1]) // Line 1 is covered

      // Act
      const result = sut.compute(classContent, coveredLines)

      // Assert
      const incrementMutations = result.filter(
        m => m.mutationName === 'IncrementMutator'
      )
      expect(incrementMutations).toHaveLength(1)
      expect(incrementMutations[0].replacement).toEqual('--')
    })

    it('should return mutations for comparison operator on covered lines', () => {
      // Arrange
      const classContent =
        'public class Test { public static boolean method() { return 5 < 10; } }'
      const coveredLines = new Set([1]) // Line 1 is covered

      // Act
      const result = sut.compute(classContent, coveredLines)

      // Assert
      const boundaryMutations = result.filter(
        m => m.mutationName === 'BoundaryConditionMutator'
      )
      expect(boundaryMutations).toHaveLength(1)
      expect(boundaryMutations[0].replacement).toEqual('<=')
    })

    it('should return empty array for uncovered lines', () => {
      // Arrange
      const classContent =
        'public class Test { public static void method() { integer i = 0; ++i; } }'
      const coveredLines = new Set([2]) // Line 1 is not covered

      // Act
      const result = sut.compute(classContent, coveredLines)

      // Assert
      expect(result).toHaveLength(0)
    })

    it('should handle multiple mutations on same line', () => {
      // Arrange
      const classContent =
        'public class Test { public static void method() { for(integer i = 0; i < 10; ++i){} } }'
      const coveredLines = new Set([1])

      // Act
      const result = sut.compute(classContent, coveredLines)

      // Assert
      expect(result).toHaveLength(2) // Both < and ++ should be found

      const incrementMutation = result.find(
        m => m.mutationName === 'IncrementMutator'
      )
      const boundaryMutation = result.find(
        m => m.mutationName === 'BoundaryConditionMutator'
      )

      expect(incrementMutation).toBeDefined()
      expect(incrementMutation?.replacement).toBe('--')

      expect(boundaryMutation).toBeDefined()
      expect(boundaryMutation?.replacement).toBe('<=')
    })
  })

  describe('when mutating code', () => {
    it('should return mutated code with increment replacement applied', () => {
      // Arrange
      const classContent =
        'public class Test { public static void method() { integer i = 0; ++i; } }'
      const coveredLines = new Set([1])
      const mutations = sut.compute(classContent, coveredLines)
      const incrementMutation = mutations.find(
        m => m.mutationName === 'IncrementMutator'
      )!

      // Act
      const result = sut.mutate(incrementMutation)

      // Assert
      expect(result).toContain('--i;')
      expect(result).not.toContain('++i;')
    })

    it('should return mutated code with boundary replacement applied', () => {
      // Arrange
      const classContent =
        'public class Test { public static boolean method() { return 5 < 10; } }'
      const coveredLines = new Set([1])
      const mutations = sut.compute(classContent, coveredLines)
      const boundaryMutation = mutations.find(
        m => m.mutationName === 'BoundaryConditionMutator'
      )!

      // Act
      const result = sut.mutate(boundaryMutation)

      // Assert
      expect(result).toContain('5 <= 10')
      expect(result).not.toContain('5 < 10')
    })
  })
})
