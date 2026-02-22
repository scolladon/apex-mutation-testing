import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { EqualityConditionMutator } from '../../src/mutator/equalityConditionMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'

describe('EqualityConditionMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const equalityMutator = new EqualityConditionMutator()
    const listener = new MutationListener([equalityMutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with == operator', () => {
    it('Then should generate mutation replacing == with !=', () => {
      const code = `
        public class TestClass {
          public void test() {
            if (a == b) {
              doSomething();
            }
          }
        }
      `
      const mutations = parseAndMutate(code, new Set([4]))
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('!=')
      expect(mutations[0].mutationName).toBe('EqualityConditionMutator')
    })
  })

  describe('Given Apex code with != operator', () => {
    it('Then should generate mutation replacing != with ==', () => {
      const code = `
        public class TestClass {
          public void test() {
            if (x != y) {
              doSomething();
            }
          }
        }
      `
      const mutations = parseAndMutate(code, new Set([4]))
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('==')
    })
  })

  describe('Given Apex code with equality operators on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      const code = `
        public class TestClass {
          public void test() {
            if (a == b) {
              doSomething();
            }
          }
        }
      `
      const mutations = parseAndMutate(code, new Set([5]))
      expect(mutations.length).toBe(0)
    })
  })
})
