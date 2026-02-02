import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { RemoveConditionalsMutator } from '../../src/mutator/removeConditionalsMutator.js'

describe('RemoveConditionalsMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const removeConditionalsMutator = new RemoveConditionalsMutator()
    const listener = new MutationListener(
      [removeConditionalsMutator],
      coveredLines
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with simple if statement', () => {
    it('Then should generate mutations replacing condition with true and false', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (x > 0) {
              doSomething();
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(2)
      expect(mutations[0].replacement).toBe('(true)')
      expect(mutations[1].replacement).toBe('(false)')
      expect(mutations[0].mutationName).toBe('RemoveConditionalsMutator')
    })
  })

  describe('Given Apex code with if-else statement', () => {
    it('Then should generate mutations for the condition', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (condition) {
              doA();
            } else {
              doB();
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(2)
      expect(mutations[0].replacement).toBe('(true)')
      expect(mutations[1].replacement).toBe('(false)')
    })
  })

  describe('Given Apex code with nested if statements', () => {
    it('Then should generate mutations for each if statement', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (outer) {
              if (inner) {
                doSomething();
              }
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4, 5]))

      // Assert
      // 2 mutations for outer if, 2 for inner if
      expect(mutations.length).toBe(4)
    })
  })

  describe('Given Apex code with else-if chain', () => {
    it('Then should generate mutations for each condition', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (a) {
              doA();
            } else if (b) {
              doB();
            } else {
              doC();
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4, 6]))

      // Assert
      // 2 mutations for first if, 2 for else-if
      expect(mutations.length).toBe(4)
    })
  })

  describe('Given Apex code with complex condition', () => {
    it('Then should generate mutations for the whole condition', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (a && b || c) {
              doSomething();
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(2)
      expect(mutations[0].replacement).toBe('(true)')
      expect(mutations[1].replacement).toBe('(false)')
    })
  })

  describe('Given Apex code with if on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (x > 0) {
              doSomething();
            }
          }
        }
      `

      // Act - line 4 is not covered
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with ternary operator', () => {
    it('Then should not generate mutations for ternary', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return x > 0 ? 1 : 0;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      // Ternary is not an IfStatement, so no mutations
      expect(mutations.length).toBe(0)
    })
  })
})
