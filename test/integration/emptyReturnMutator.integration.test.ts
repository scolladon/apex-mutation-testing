import { ParserRuleContext } from 'antlr4ts'
import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { EmptyReturnMutator } from '../../src/mutator/emptyReturnMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { MutantGenerator } from '../../src/service/mutantGenerator.js'
import { TypeDiscoverer } from '../../src/service/typeDiscoverer.js'
import {
  ApexClassTypeMatcher,
  SObjectTypeMatcher,
} from '../../src/service/typeMatcher.js'

describe('EmptyReturnMutator Integration', () => {
  let mutantGenerator: MutantGenerator

  beforeEach(() => {
    mutantGenerator = new MutantGenerator()
  })

  const buildTypeRegistry = async (code: string) => {
    const typeDiscoverer = new TypeDiscoverer()
      .withMatcher(new ApexClassTypeMatcher(new Set()))
      .withMatcher(new SObjectTypeMatcher(new Set()))
    return typeDiscoverer.analyze(code)
  }

  describe('when mutating return statements', () => {
    it('should create mutations for non-empty integer return values', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Integer getValue() {
              return 42;
            }
          }
        `
      const coveredLines = new Set([4]) // "return 42;"

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeRegistry = await buildTypeRegistry(classContent)
      const emptyReturnMutator = new EmptyReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([emptyReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyReturnMutations = mutations.filter(
        m => m.mutationName === 'EmptyReturnMutator'
      )
      expect(emptyReturnMutations.length).toBeGreaterThan(0)

      if (emptyReturnMutations.length > 0) {
        expect(emptyReturnMutations[0].replacement).toBe('0')

        // Test actual mutation
        const result = mutantGenerator.mutate(emptyReturnMutations[0])
        expect(result).toContain('return 0;')
        expect(result).not.toContain('return 42;')
      }
    })
  })
})
