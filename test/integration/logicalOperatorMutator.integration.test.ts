import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { LogicalOperatorMutator } from '../../src/mutator/logicalOperatorMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'

describe('LogicalOperatorMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const logicalOperatorMutator = new LogicalOperatorMutator()
    const listener = new MutationListener(
      [logicalOperatorMutator],
      coveredLines
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with && operator', () => {
    it('Then should generate mutation replacing && with ||', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (a && b) {
              doSomething();
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('||')
      expect(mutations[0].mutationName).toBe('LogicalOperatorMutator')
    })
  })

  describe('Given Apex code with || operator', () => {
    it('Then should generate mutation replacing || with &&', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (x || y) {
              doSomething();
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('&&')
      expect(mutations[0].mutationName).toBe('LogicalOperatorMutator')
    })
  })

  describe('Given Apex code with nested logical operators', () => {
    it('Then should generate mutations for each operator', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Boolean result = (a && b) || (c && d);
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      // Should find 3 operators: && (twice) and || (once)
      expect(mutations.length).toBe(3)
      expect(mutations.filter(m => m.replacement === '||').length).toBe(2)
      expect(mutations.filter(m => m.replacement === '&&').length).toBe(1)
    })
  })

  describe('Given Apex code with logical operators on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (a && b) {
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
})
