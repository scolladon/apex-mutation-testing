import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { MemberVariableMutator } from '../../src/mutator/memberVariableMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'

describe('MemberVariableMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const mutator = new MemberVariableMutator()
    const listener = new MutationListener([mutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with initialized member variable', () => {
    it('Then should generate mutation removing the initializer', () => {
      // Arrange
      const code = `
        public class TestClass {
          private Integer count = 5;
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([3]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('count')
      expect(mutations[0].mutationName).toBe('MemberVariableMutator')
    })
  })

  describe('Given Apex code with uninitialized member variable', () => {
    it('Then should NOT generate any mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          private Integer count;
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([3]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with boolean member variable', () => {
    it('Then should generate mutation removing the initializer', () => {
      // Arrange
      const code = `
        public class TestClass {
          private Boolean isActive = true;
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([3]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('isActive')
    })
  })

  describe('Given Apex code with member variable on uncovered line', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          private Integer count = 5;
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })
})
