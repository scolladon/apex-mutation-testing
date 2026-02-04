import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { RemoveIncrementsMutator } from '../../src/mutator/removeIncrementsMutator.js'

describe('RemoveIncrementsMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const removeIncrementsMutator = new RemoveIncrementsMutator()
    const listener = new MutationListener(
      [removeIncrementsMutator],
      coveredLines
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with post-increment', () => {
    it('Then should generate mutation removing the increment', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            i++;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('i')
      expect(mutations[0].mutationName).toBe('RemoveIncrementsMutator')
    })
  })

  describe('Given Apex code with post-decrement', () => {
    it('Then should generate mutation removing the decrement', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            j--;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('j')
    })
  })

  describe('Given Apex code with pre-increment', () => {
    it('Then should generate mutation removing the increment', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            ++i;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('i')
    })
  })

  describe('Given Apex code with pre-decrement', () => {
    it('Then should generate mutation removing the decrement', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            --j;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('j')
    })
  })

  describe('Given Apex code with multiple increment operations', () => {
    it('Then should generate mutations for each operation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            i++;
            j--;
            ++k;
            --m;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4, 5, 6, 7]))

      // Assert
      expect(mutations.length).toBe(4)
      expect(mutations[0].replacement).toBe('i')
      expect(mutations[1].replacement).toBe('j')
      expect(mutations[2].replacement).toBe('k')
      expect(mutations[3].replacement).toBe('m')
    })
  })

  describe('Given Apex code with increment in for loop', () => {
    it('Then should generate mutation for the increment', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            for (Integer i = 0; i < 10; i++) {
              System.debug(i);
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('i')
    })
  })

  describe('Given Apex code with unary minus (not increment)', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer x = -5;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with increment on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            i++;
          }
        }
      `

      // Act - line 4 is not covered
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with increment in expression', () => {
    it('Then should generate mutation for increment used in assignment', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer x = i++;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('i')
    })
  })
})
