import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { NakedReceiverMutator } from '../../src/mutator/nakedReceiverMutator.js'
import { ApexMethod, ApexType } from '../../src/type/ApexMethod.js'

describe('NakedReceiverMutator Integration', () => {
  const parseAndMutate = (
    code: string,
    coveredLines: Set<number>,
    typeTable?: Map<string, ApexMethod>
  ) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const mutator = new NakedReceiverMutator()
    const listener = new MutationListener([mutator], coveredLines, typeTable)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with dot expression where receiver type matches return type', () => {
    it('Then should generate mutation replacing expression with receiver', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            String s = 'hello';
            String result = s.toUpperCase();
          }
        }
      `
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('toUpperCase', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })

      // Act
      const mutations = parseAndMutate(code, new Set([5]), typeTable)

      // Assert
      const nakedMutations = mutations.filter(
        m => m.mutationName === 'NakedReceiverMutator'
      )
      expect(nakedMutations.length).toBe(1)
      expect(nakedMutations[0].replacement).toBe('s')
    })
  })

  describe('Given Apex code with dot expression where types do not match', () => {
    it('Then should NOT generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer num = 5;
            String result = num.toString();
          }
        }
      `
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('toString', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })

      // Act
      const mutations = parseAndMutate(code, new Set([5]), typeTable)

      // Assert
      const nakedMutations = mutations.filter(
        m => m.mutationName === 'NakedReceiverMutator'
      )
      expect(nakedMutations.length).toBe(0)
    })
  })

  describe('Given Apex code with dot expression on uncovered line', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            String s = 'hello';
            String result = s.toUpperCase();
          }
        }
      `
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('toUpperCase', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })

      // Act
      const mutations = parseAndMutate(code, new Set([4]), typeTable)

      // Assert
      const nakedMutations = mutations.filter(
        m => m.mutationName === 'NakedReceiverMutator'
      )
      expect(nakedMutations.length).toBe(0)
    })
  })
})
