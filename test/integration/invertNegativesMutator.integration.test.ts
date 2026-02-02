import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { InvertNegativesMutator } from '../../src/mutator/invertNegativesMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'

describe('InvertNegativesMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const invertNegativesMutator = new InvertNegativesMutator()
    const listener = new MutationListener(
      [invertNegativesMutator],
      coveredLines
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with negated variable', () => {
    it('Then should generate mutation removing the negation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer result = -x;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('x')
      expect(mutations[0].mutationName).toBe('InvertNegativesMutator')
    })
  })

  describe('Given Apex code with negated literal', () => {
    it('Then should generate mutation removing the negation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer result = -5;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('5')
    })
  })

  describe('Given Apex code with negated expression', () => {
    it('Then should generate mutation removing the negation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer result = -(a + b);
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('(a+b)')
    })
  })

  describe('Given Apex code with multiple negations', () => {
    it('Then should generate mutations for each negation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer a = -x;
            Integer b = -y;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4, 5]))

      // Assert
      expect(mutations.length).toBe(2)
      expect(mutations[0].replacement).toBe('x')
      expect(mutations[1].replacement).toBe('y')
    })
  })

  describe('Given Apex code with increment/decrement (not negation)', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            ++i;
            --j;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4, 5]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with negation on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer result = -x;
          }
        }
      `

      // Act - line 4 is not covered
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })
})
