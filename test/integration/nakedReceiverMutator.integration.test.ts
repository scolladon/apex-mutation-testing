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
import { TypeDiscoverer } from '../../src/service/typeDiscoverer.js'
import { ApexClassTypeMatcher } from '../../src/service/typeMatcher.js'

describe('NakedReceiverMutator Integration', () => {
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

    const mutator = new NakedReceiverMutator(typeRegistry)
    const listener = new MutationListener([mutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with dot expression where receiver type matches return type', () => {
    it('Then should generate mutation replacing expression with receiver', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public String toUpperCase() { return ''; }
          public void test() {
            String s = 'hello';
            String result = s.toUpperCase();
          }
        }
      `

      // Act
      const mutations = await parseAndMutateTypeAware(code, new Set([6]))

      // Assert
      const nakedMutations = mutations.filter(
        m => m.mutationName === 'NakedReceiverMutator'
      )
      expect(nakedMutations.length).toBe(1)
      expect(nakedMutations[0].replacement).toBe('s')
    })
  })

  describe('Given Apex code with dot expression where types do not match', () => {
    it('Then should NOT generate mutations', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public String toString() { return ''; }
          public void test() {
            Integer num = 5;
            String result = num.toString();
          }
        }
      `

      // Act
      const mutations = await parseAndMutateTypeAware(code, new Set([6]))

      // Assert
      const nakedMutations = mutations.filter(
        m => m.mutationName === 'NakedReceiverMutator'
      )
      expect(nakedMutations.length).toBe(0)
    })
  })

  describe('Given Apex code with dot expression on uncovered line', () => {
    it('Then should not generate mutations', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public String toUpperCase() { return ''; }
          public void test() {
            String s = 'hello';
            String result = s.toUpperCase();
          }
        }
      `

      // Act
      const mutations = await parseAndMutateTypeAware(code, new Set([4]))

      // Assert
      const nakedMutations = mutations.filter(
        m => m.mutationName === 'NakedReceiverMutator'
      )
      expect(nakedMutations.length).toBe(0)
    })
  })
})
