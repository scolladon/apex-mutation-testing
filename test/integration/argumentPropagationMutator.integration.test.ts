import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { ArgumentPropagationMutator } from '../../src/mutator/argumentPropagationMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { ApexMethod, ApexType } from '../../src/type/ApexMethod.js'

describe('ArgumentPropagationMutator Integration', () => {
  const parseAndMutate = (
    code: string,
    coveredLines: Set<number>,
    typeTable?: Map<string, ApexMethod>
  ) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const mutator = new ArgumentPropagationMutator()
    const listener = new MutationListener([mutator], coveredLines, typeTable)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with method call having matching-type argument', () => {
    it('Then should generate mutation replacing call with argument', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            String input = 'hello';
            String result = process(input);
          }
        }
      `
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })

      // Act
      const mutations = parseAndMutate(code, new Set([5]), typeTable)

      // Assert
      const argMutations = mutations.filter(
        m => m.mutationName === 'ArgumentPropagationMutator'
      )
      expect(argMutations.length).toBe(1)
      expect(argMutations[0].replacement).toBe('input')
    })
  })

  describe('Given Apex code with method not in type table', () => {
    it('Then should NOT generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            String result = process('hello');
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      const argMutations = mutations.filter(
        m => m.mutationName === 'ArgumentPropagationMutator'
      )
      expect(argMutations.length).toBe(0)
    })
  })

  describe('Given Apex code with method call on uncovered line', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            String result = process('hello');
          }
        }
      `
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })

      // Act
      const mutations = parseAndMutate(code, new Set([5]), typeTable)

      // Assert
      const argMutations = mutations.filter(
        m => m.mutationName === 'ArgumentPropagationMutator'
      )
      expect(argMutations.length).toBe(0)
    })
  })
})
