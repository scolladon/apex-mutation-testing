import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { BoundaryConditionMutator } from '../../src/mutator/boundaryConditionMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'

describe('BoundaryConditionMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const boundaryMutator = new BoundaryConditionMutator()
    const listener = new MutationListener([boundaryMutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with < operator', () => {
    it('Then should generate mutation replacing < with <=', () => {
      const code = `
        public class TestClass {
          public void test() {
            if (a < b) {
              doSomething();
            }
          }
        }
      `
      const mutations = parseAndMutate(code, new Set([4]))
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('<=')
      expect(mutations[0].mutationName).toBe('BoundaryConditionMutator')
    })
  })

  describe('Given Apex code with >= operator', () => {
    it('Then should generate mutation replacing >= with >', () => {
      const code = `
        public class TestClass {
          public void test() {
            if (x >= y) {
              doSomething();
            }
          }
        }
      `
      const mutations = parseAndMutate(code, new Set([4]))
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('>')
    })
  })

  describe('Given Apex code with boundary operators on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      const code = `
        public class TestClass {
          public void test() {
            if (a < b) {
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
