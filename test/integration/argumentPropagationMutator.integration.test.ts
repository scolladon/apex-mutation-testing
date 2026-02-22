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
import { TypeDiscoverer } from '../../src/service/typeDiscoverer.js'
import { ApexClassTypeMatcher } from '../../src/service/typeMatcher.js'

describe('ArgumentPropagationMutator Integration', () => {
  const parseAndMutateTypeAware = async (
    code: string,
    coveredLines: Set<number>
  ) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const typeDiscoverer = new TypeDiscoverer().withMatcher(
      new ApexClassTypeMatcher(new Set())
    )
    const typeRegistry = await typeDiscoverer.analyze(code)

    const mutator = new ArgumentPropagationMutator(typeRegistry)
    const listener = new MutationListener([mutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with method call having matching-type argument', () => {
    it('Then should generate mutation replacing call with argument', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public String process(String s) { return s; }
          public void test() {
            String input = 'hello';
            String result = process(input);
          }
        }
      `

      // Act
      const mutations = await parseAndMutateTypeAware(code, new Set([6]))

      // Assert
      const argMutations = mutations.filter(
        m => m.mutationName === 'ArgumentPropagationMutator'
      )
      expect(argMutations.length).toBe(1)
      expect(argMutations[0].replacement).toBe('input')
    })
  })

  describe('Given Apex code with method not in class', () => {
    it('Then should NOT generate mutations for unknown methods', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            String result = unknownMethod('hello');
          }
        }
      `

      // Act
      const mutations = await parseAndMutateTypeAware(code, new Set([4]))

      // Assert
      const argMutations = mutations.filter(
        m => m.mutationName === 'ArgumentPropagationMutator'
      )
      expect(argMutations.length).toBe(0)
    })
  })

  describe('Given Apex code with method call on uncovered line', () => {
    it('Then should not generate mutations', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public String process(String s) { return s; }
          public void test() {
            String result = process('hello');
          }
        }
      `

      // Act
      const mutations = await parseAndMutateTypeAware(code, new Set([3]))

      // Assert
      const argMutations = mutations.filter(
        m => m.mutationName === 'ArgumentPropagationMutator'
      )
      expect(argMutations.length).toBe(0)
    })
  })
})
