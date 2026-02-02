import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { ArithmeticOperatorMutator } from '../../src/mutator/arithmeticOperatorMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'

describe('ArithmeticOperatorMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const arithmeticOperatorMutator = new ArithmeticOperatorMutator()
    const listener = new MutationListener(
      [arithmeticOperatorMutator],
      coveredLines
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with addition operator', () => {
    it('Then should generate mutations replacing addition with other operators', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a + b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(3)
      expect(mutations[0].replacement).toBe('-')
      expect(mutations[1].replacement).toBe('*')
      expect(mutations[2].replacement).toBe('/')
      expect(mutations[0].mutationName).toBe('ArithmeticOperatorMutator')
    })
  })

  describe('Given Apex code with subtraction operator', () => {
    it('Then should generate mutations replacing subtraction with other operators', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a - b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(3)
      const replacements = mutations.map(m => m.replacement)
      expect(replacements).toContain('+')
      expect(replacements).toContain('*')
      expect(replacements).toContain('/')
    })
  })

  describe('Given Apex code with multiplication operator', () => {
    it('Then should generate mutations replacing multiplication with other operators', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a * b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(3)
      const replacements = mutations.map(m => m.replacement)
      expect(replacements).toContain('+')
      expect(replacements).toContain('-')
      expect(replacements).toContain('/')
    })
  })

  describe('Given Apex code with division operator', () => {
    it('Then should generate mutations replacing division with other operators', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a / b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(3)
      const replacements = mutations.map(m => m.replacement)
      expect(replacements).toContain('+')
      expect(replacements).toContain('-')
      expect(replacements).toContain('*')
    })
  })

  describe('Given Apex code with arithmetic on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a + b;
          }
        }
      `

      // Act - line 4 is not covered
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with arithmetic in assignment', () => {
    it('Then should generate mutations for the arithmetic operator', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer result = x * y;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(3)
      const replacements = mutations.map(m => m.replacement)
      expect(replacements).toContain('+')
      expect(replacements).toContain('-')
      expect(replacements).toContain('/')
    })
  })

  describe('Given Apex code with multiple arithmetic operators', () => {
    it('Then should generate mutations for each operator', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a + b - c;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      // 3 mutations for + and 3 for -
      expect(mutations.length).toBe(6)
    })
  })
})
