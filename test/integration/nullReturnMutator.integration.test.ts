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
import { NullReturnMutator } from '../../src/mutator/nullReturnMutator.js'
import { MutantGenerator } from '../../src/service/mutantGenerator.js'
import { TypeDiscoverer } from '../../src/service/typeDiscoverer.js'
import {
  ApexClassTypeMatcher,
  SObjectTypeMatcher,
} from '../../src/service/typeMatcher.js'

describe('NullReturnMutator Integration', () => {
  let mutantGenerator: MutantGenerator

  beforeEach(() => {
    mutantGenerator = new MutantGenerator()
  })

  const buildTypeRegistry = async (
    code: string,
    sObjectTypes: string[] = []
  ) => {
    const typeDiscoverer = new TypeDiscoverer()
      .withMatcher(new ApexClassTypeMatcher(new Set()))
      .withMatcher(new SObjectTypeMatcher(new Set(sObjectTypes)))
    return typeDiscoverer.analyze(code)
  }

  describe('when mutating non-primitive return statements', () => {
    it('should create mutations for String return values', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static String getName() {
              return 'FirstName LastName';
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
      const nullReturnMutator = new NullReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([nullReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturnMutator'
      )
      expect(nullReturnMutations.length).toBeGreaterThan(0)

      if (nullReturnMutations.length > 0) {
        expect(nullReturnMutations[0].replacement).toBe('null')

        const result = mutantGenerator.mutate(nullReturnMutations[0])
        expect(result).toContain('return null;')
        expect(result).not.toContain("return 'FirstName LastName';")
      }
    })

    it('should create mutations for Object return values', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Account getAccount() {
              return new Account(Name = 'Test');
            }
          }
        `
      const coveredLines = new Set([4])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeRegistry = await buildTypeRegistry(classContent, ['Account'])
      const nullReturnMutator = new NullReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([nullReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturnMutator'
      )
      expect(nullReturnMutations.length).toBeGreaterThan(0)

      if (nullReturnMutations.length > 0) {
        expect(nullReturnMutations[0].replacement).toBe('null')

        const result = mutantGenerator.mutate(nullReturnMutations[0])
        expect(result).toContain('return null;')
        expect(result).not.toContain('return new Account')
      }
    })

    it('should create mutations for List return values', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static List<Account> getAccounts() {
              return [SELECT Id FROM Account LIMIT 10];
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
      const nullReturnMutator = new NullReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([nullReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturnMutator'
      )
      expect(nullReturnMutations.length).toBeGreaterThan(0)

      if (nullReturnMutations.length > 0) {
        expect(nullReturnMutations[0].replacement).toBe('null')

        const result = mutantGenerator.mutate(nullReturnMutations[0])
        expect(result).toContain('return null;')
        expect(result).not.toContain('return [SELECT')
      }
    })
  })

  describe('when mutating primitive return statements', () => {
    it('should create mutations for Integer return values', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Integer getCount() {
              return 10;
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
      const nullReturnMutator = new NullReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([nullReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturnMutator'
      )
      expect(nullReturnMutations.length).toBeGreaterThan(0)

      if (nullReturnMutations.length > 0) {
        expect(nullReturnMutations[0].replacement).toBe('null')

        const result = mutantGenerator.mutate(nullReturnMutations[0])
        expect(result).toContain('return null;')
        expect(result).not.toContain('return 10;')
      }
    })

    it('should create mutations for Boolean return values', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean isValid() {
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
      const nullReturnMutator = new NullReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([nullReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturnMutator'
      )
      expect(nullReturnMutations.length).toBeGreaterThan(0)

      if (nullReturnMutations.length > 0) {
        expect(nullReturnMutations[0].replacement).toBe('null')

        const result = mutantGenerator.mutate(nullReturnMutations[0])
        expect(result).toContain('return null;')
        expect(result).not.toContain('return true;')
      }
    })

    it('should not create mutations for void methods', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static void processData() {
              System.debug('Processing data');
              return;
            }
          }
        `
      const coveredLines = new Set([4, 5])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)

      const typeRegistry = await buildTypeRegistry(classContent)
      const nullReturnMutator = new NullReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([nullReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturnMutator'
      )
      expect(nullReturnMutations.length).toBe(0)
    })
  })

  describe('when handling already null returns', () => {
    it('should not create mutations for already null returns', async () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static String getNullString() {
              return null;
            }
          }
        `
      const coveredLines = new Set([4])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)

      const typeRegistry = await buildTypeRegistry(classContent)
      const nullReturnMutator = new NullReturnMutator(typeRegistry)

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener([nullReturnMutator], coveredLines)

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturnMutator'
      )
      expect(nullReturnMutations.length).toBe(0)
    })
  })
})
