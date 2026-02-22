import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { IncrementMutator } from '../../src/mutator/incrementMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'

describe('IncrementMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const incrementMutator = new IncrementMutator()
    const listener = new MutationListener([incrementMutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with prefix ++ operator', () => {
    it('Then should generate mutation replacing ++ with --', () => {
      const code = `
        public class TestClass {
          public void test() {
            Integer i = 0;
            ++i;
          }
        }
      `
      const mutations = parseAndMutate(code, new Set([5]))
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('--')
      expect(mutations[0].mutationName).toBe('IncrementMutator')
    })
  })

  describe('Given Apex code with postfix -- operator', () => {
    it('Then should generate mutation replacing -- with ++', () => {
      const code = `
        public class TestClass {
          public void test() {
            Integer i = 10;
            i--;
          }
        }
      `
      const mutations = parseAndMutate(code, new Set([5]))
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('++')
    })
  })

  describe('Given Apex code with increment on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      const code = `
        public class TestClass {
          public void test() {
            Integer i = 0;
            ++i;
          }
        }
      `
      const mutations = parseAndMutate(code, new Set([4]))
      const incrementMutations = mutations.filter(
        m => m.mutationName === 'IncrementMutator'
      )
      expect(incrementMutations.length).toBe(0)
    })
  })
})
