import { MutantGenerator } from '../../../src/service/mutantGenerator.js'

describe('MutantGenerator', () => {
  let sut: MutantGenerator

  beforeEach(() => {
    sut = new MutantGenerator()
  })

  describe('when computing mutations', () => {
    it('should return an array of mutations', () => {
      // Arrange
      const classContent =
        'public class Mutation { public static void mutate() { for(Integer i = 0 ; i < 10 ; ++i){} } }'

      // Act
      const result = sut.compute(classContent)

      // Assert
      expect(result[0].replacement).toEqual('--')
    })
  })

  describe('when mutating code', () => {
    it('should return mutated code', () => {
      // Arrange
      const classContent =
        'public class Mutation { public static void mutate() { for(Integer i = 0 ; i < 10 ; ++i){} } }'
      const mutation = sut.compute(classContent)

      // Act
      const result = sut.mutate(mutation[0])

      // Assert
      expect(result).toEqual(
        'public class Mutation { public static void mutate() { for(Integer i = 0 ; i < 10 ; --i){} } }'
      )
    })
  })
})
