import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { UnaryOperatorInsertionMutator } from '../../src/mutator/unaryOperatorInsertionMutator.js'

describe('UnaryOperatorInsertionMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const mutator = new UnaryOperatorInsertionMutator()
    const listener = new MutationListener([mutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with a variable reference', () => {
    it('Then should generate 4 mutations (x++, ++x, x--, --x)', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            Integer x = 5;
            return x;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert
      const uoiMutations = mutations.filter(
        m => m.mutationName === 'UnaryOperatorInsertionMutator'
      )
      expect(uoiMutations.length).toBe(4)
      expect(uoiMutations.map(m => m.replacement)).toEqual(
        expect.arrayContaining(['x++', '++x', 'x--', '--x'])
      )
    })
  })

  describe('Given Apex code with a literal', () => {
    it('Then should NOT generate mutations for numeric literals', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return 42;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      const uoiMutations = mutations.filter(
        m => m.mutationName === 'UnaryOperatorInsertionMutator'
      )
      expect(uoiMutations.length).toBe(0)
    })
  })

  describe('Given Apex code with variable on uncovered line', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            Integer x = 5;
            return x;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      const uoiMutations = mutations.filter(
        m => m.mutationName === 'UnaryOperatorInsertionMutator'
      )
      expect(uoiMutations.length).toBe(0)
    })
  })
})
