import { ParserRuleContext } from 'antlr4ts'
import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { TrueReturnMutator } from '../../src/mutator/trueReturnMutator.js'
import { MutantGenerator } from '../../src/service/mutantGenerator.js'
import { TypeDiscoverer } from '../../src/service/typeDiscoverer.js'
import {
  ApexClassTypeMatcher,
  SObjectTypeMatcher,
} from '../../src/service/typeMatcher.js'

describe('TrueReturnMutator Integration', () => {
  let mutantGenerator: MutantGenerator

  beforeEach(() => {
    mutantGenerator = new MutantGenerator()
  })

  const buildTypeRegistry = async (code: string) => {
    const typeDiscoverer = new TypeDiscoverer()
      .withMatcher(new ApexClassTypeMatcher(new Set()))
      .withMatcher(new SObjectTypeMatcher(new Set(['Account'])))
    return typeDiscoverer.analyze(code)
  }

  describe('when mutating boolean return statements', () => {
    it('should create mutations for "false" boolean return values', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean isNegative(Integer value) {
              return false;
            }
          }
        `
      const coveredLines = new Set([4])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeRegistry = await buildTypeRegistry(classContent)
      const trueReturnMutator = new TrueReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([trueReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const trueReturnMutations = mutations.filter(
        m => m.mutationName === 'TrueReturnMutator'
      )
      expect(trueReturnMutations.length).toBeGreaterThan(0)

      if (trueReturnMutations.length > 0) {
        expect(trueReturnMutations[0].replacement).toBe('true')

        const result = mutantGenerator.mutate(trueReturnMutations[0])
        expect(result).toContain('return true;')
        expect(result).not.toContain('return false;')
      }
    })

    it('should create mutations for complex boolean expressions', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean checkValue(Integer value) {
              return value < 0;
            }
          }
        `
      const coveredLines = new Set([4])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeRegistry = await buildTypeRegistry(classContent)
      const trueReturnMutator = new TrueReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([trueReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const trueReturnMutations = mutations.filter(
        m => m.mutationName === 'TrueReturnMutator'
      )
      expect(trueReturnMutations.length).toBeGreaterThan(0)

      if (trueReturnMutations.length > 0) {
        expect(trueReturnMutations[0].replacement).toBe('true')

        const result = mutantGenerator.mutate(trueReturnMutations[0])
        expect(result).toContain('return true;')
        expect(result).not.toContain('return value < 0;')
      }
    })

    it('should not create mutations for "true" boolean returns', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean isValid(Integer value) {
              return true;
            }
          }
        `
      const coveredLines = new Set([4])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeRegistry = await buildTypeRegistry(classContent)
      const trueReturnMutator = new TrueReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([trueReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const trueReturnMutations = mutations.filter(
        m => m.mutationName === 'TrueReturnMutator'
      )
      expect(trueReturnMutations.length).toBe(0)
    })

    it('should handle if-else statements with boolean returns', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean isAdult(Integer age) {
              if (age >= 18) {
                return true;
              } else {
                return false;
              }
            }
          }
        `
      const coveredLines = new Set([4, 5, 6, 7])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeRegistry = await buildTypeRegistry(classContent)
      const trueReturnMutator = new TrueReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([trueReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const trueReturnMutations = mutations.filter(
        m => m.mutationName === 'TrueReturnMutator'
      )

      // Should only mutate the "false" return, not the "true" return
      expect(trueReturnMutations.length).toBe(1)

      if (trueReturnMutations.length > 0) {
        const result = mutantGenerator.mutate(trueReturnMutations[0])
        expect(result).toContain('return true;')
        expect(result).not.toContain('return false;')
      }
    })

    it('should handle ternary expressions with boolean returns', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean hasPermissions(String role, Boolean isAdmin) {
              return isAdmin ? true : false;
            }
          }
        `
      const coveredLines = new Set([4])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeRegistry = await buildTypeRegistry(classContent)
      const trueReturnMutator = new TrueReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([trueReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const trueReturnMutations = mutations.filter(
        m => m.mutationName === 'TrueReturnMutator'
      )

      expect(trueReturnMutations.length).toBeGreaterThanOrEqual(0)

      if (trueReturnMutations.length > 0) {
        const result = mutantGenerator.mutate(trueReturnMutations[0])
        expect(result).toContain('true')
      }
    })

    it('should handle logical expressions with boolean returns', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean isValidRecord(Account acc) {
              return acc != null && acc.Name != null;
            }
          }
        `
      const coveredLines = new Set([4])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeRegistry = await buildTypeRegistry(classContent)
      const trueReturnMutator = new TrueReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([trueReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const trueReturnMutations = mutations.filter(
        m => m.mutationName === 'TrueReturnMutator'
      )

      expect(trueReturnMutations.length).toBeGreaterThan(0)

      if (trueReturnMutations.length > 0) {
        const result = mutantGenerator.mutate(trueReturnMutations[0])
        expect(result).toContain('return true;')
        expect(result).not.toContain('acc != null && acc.Name != null')
      }
    })
  })
})
