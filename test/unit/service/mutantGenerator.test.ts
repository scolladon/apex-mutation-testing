import { MutantGenerator } from '../../../src/service/mutantGenerator.js'

describe('MutantGenerator', () => {
  let sut: MutantGenerator

  beforeEach(() => {
    sut = new MutantGenerator()
  })

  describe('when computing mutations', () => {
    it('should return an array of mutations for covered lines', () => {
      // Arrange
      const classContent =
        'public class Mutation { public static void mutate() { for(Integer i = 0 ; i < 10 ; ++i){} } }'
      const coveredLines = new Set([1]) // Line 1 is covered

      // Act
      const result = sut.compute(classContent, coveredLines)

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].replacement).toEqual('--')
    })

    it('should return empty array for uncovered lines', () => {
      // Arrange
      const classContent =
        'public class Mutation { public static void mutate() { for(Integer i = 0 ; i < 10 ; ++i){} } }'
      const coveredLines = new Set([2]) // Line 1 is not covered

      // Act
      const result = sut.compute(classContent, coveredLines)

      // Assert
      expect(result).toHaveLength(0)
    })
  })

  describe('when mutating code', () => {
    it('should return mutated code with replacement applied', () => {
      // Arrange
      const classContent =
        'public class Mutation { public static void mutate() { for(Integer i = 0 ; i < 10 ; ++i){} } }'
      const coveredLines = new Set([1])
      const mutation = sut.compute(classContent, coveredLines)

      // Act
      const result = sut.mutate(mutation[0])

      // Assert
      expect(result).toEqual(
        'public class Mutation { public static void mutate() { for(Integer i = 0 ; i < 10 ; --i){} } }'
      )
    })
  })
})
