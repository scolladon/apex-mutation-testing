import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { BitwiseOperatorMutator } from '../../src/mutator/bitwiseOperatorMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'

describe('BitwiseOperatorMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const bitwiseOperatorMutator = new BitwiseOperatorMutator()
    const listener = new MutationListener(
      [bitwiseOperatorMutator],
      coveredLines
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with & operator', () => {
    it('Then should generate mutation replacing & with |', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer result = a & b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('|')
      expect(mutations[0].mutationName).toBe('BitwiseOperatorMutator')
    })
  })

  describe('Given Apex code with | operator', () => {
    it('Then should generate mutation replacing | with &', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer result = a | b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('&')
      expect(mutations[0].mutationName).toBe('BitwiseOperatorMutator')
    })
  })

  describe('Given Apex code with ^ operator', () => {
    it('Then should generate mutation replacing ^ with &', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer result = a ^ b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('&')
      expect(mutations[0].mutationName).toBe('BitwiseOperatorMutator')
    })
  })

  describe('Given Apex code with bitwise operators on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer result = a & b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })
})
