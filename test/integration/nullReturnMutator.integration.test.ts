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
import { ApexTypeResolver } from '../../src/service/apexTypeResolver.js'
import { MutantGenerator } from '../../src/service/mutantGenerator.js'
import { ApexMethod, ApexType } from '../../src/type/ApexMethod.js'

function parseApexAndGetTypeTable(code: string): Map<string, ApexMethod> {
  const input = new CaseInsensitiveInputStream('other', code)
  const lexer = new ApexLexer(input)
  const tokens = new CommonTokenStream(lexer)
  const parser = new ApexParser(tokens)
  const tree = parser.compilationUnit()

  const resolver = new ApexTypeResolver()
  const typeTable = resolver.analyzeMethodTypes(tree as ParserRuleContext)
  return typeTable
}

describe('NullReturnMutator Integration', () => {
  let mutantGenerator: MutantGenerator

  beforeEach(() => {
    mutantGenerator = new MutantGenerator()
  })

  describe('when mutating non-primitive return statements', () => {
    it('should create mutations for String return values', () => {
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

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getName', {
        returnType: 'String',
        startLine: 3,
        endLine: 5,
        type: ApexType.STRING,
      })

      const nullReturnMutator = new NullReturnMutator()
      nullReturnMutator.setTypeTable(typeTable)
      nullReturnMutator['currentMethodName'] = 'getName'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [nullReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturn'
      )
      expect(nullReturnMutations.length).toBeGreaterThan(0)

      if (nullReturnMutations.length > 0) {
        expect(nullReturnMutations[0].replacement).toBe('null')

        // Test actual mutation
        const result = mutantGenerator.mutate(nullReturnMutations[0])
        expect(result).toContain('return null;')
        expect(result).not.toContain("return 'FirstName LastName';")
      }
    })

    it('should create mutations for Object return values', () => {
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

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getAccount', {
        returnType: 'Account',
        startLine: 3,
        endLine: 5,
        type: ApexType.OBJECT,
      })

      const nullReturnMutator = new NullReturnMutator()
      nullReturnMutator.setTypeTable(typeTable)
      nullReturnMutator['currentMethodName'] = 'getAccount'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [nullReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturn'
      )
      expect(nullReturnMutations.length).toBeGreaterThan(0)

      if (nullReturnMutations.length > 0) {
        expect(nullReturnMutations[0].replacement).toBe('null')

        const result = mutantGenerator.mutate(nullReturnMutations[0])
        expect(result).toContain('return null;')
        expect(result).not.toContain('return new Account')
      }
    })

    it('should create mutations for List return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static List<Account> getAccounts() {
              return [SELECT Id FROM Account LIMIT 10];
            }
          }
        `
      const coveredLines = new Set([4]) // "return [SELECT..."

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getAccounts', {
        returnType: 'List<Account>',
        startLine: 3,
        endLine: 5,
        type: ApexType.LIST,
      })

      const nullReturnMutator = new NullReturnMutator()
      nullReturnMutator.setTypeTable(typeTable)
      nullReturnMutator['currentMethodName'] = 'getAccounts'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [nullReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturn'
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
    it('should create mutations for Integer return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Integer getCount() {
              return 10;
            }
          }
        `
      const coveredLines = new Set([4]) // "return 10;"

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getCount', {
        returnType: 'Integer',
        startLine: 3,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      const nullReturnMutator = new NullReturnMutator()
      nullReturnMutator.setTypeTable(typeTable)
      nullReturnMutator['currentMethodName'] = 'getCount'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [nullReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturn'
      )
      expect(nullReturnMutations.length).toBeGreaterThan(0)

      if (nullReturnMutations.length > 0) {
        expect(nullReturnMutations[0].replacement).toBe('null')

        const result = mutantGenerator.mutate(nullReturnMutations[0])
        expect(result).toContain('return null;')
        expect(result).not.toContain('return 10;')
      }
    })

    it('should create mutations for Boolean return values', () => {
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

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('isValid', {
        returnType: 'Boolean',
        startLine: 3,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      const nullReturnMutator = new NullReturnMutator()
      nullReturnMutator.setTypeTable(typeTable)
      nullReturnMutator['currentMethodName'] = 'isValid'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [nullReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturn'
      )
      expect(nullReturnMutations.length).toBeGreaterThan(0)

      if (nullReturnMutations.length > 0) {
        expect(nullReturnMutations[0].replacement).toBe('null')

        const result = mutantGenerator.mutate(nullReturnMutations[0])
        expect(result).toContain('return null;')
        expect(result).not.toContain('return true;')
      }
    })

    it('should not create mutations for void methods', () => {
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

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('processData', {
        returnType: 'void',
        startLine: 3,
        endLine: 6,
        type: ApexType.VOID,
      })

      const nullReturnMutator = new NullReturnMutator()
      nullReturnMutator.setTypeTable(typeTable)
      nullReturnMutator['currentMethodName'] = 'processData'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [nullReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturn'
      )
      expect(nullReturnMutations.length).toBe(0)
    })
  })

  describe('when handling already null returns', () => {
    it('should not create mutations for already null returns', () => {
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

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getNullString', {
        returnType: 'String',
        startLine: 3,
        endLine: 5,
        type: ApexType.STRING,
      })

      const nullReturnMutator = new NullReturnMutator()
      nullReturnMutator.setTypeTable(typeTable)
      nullReturnMutator['currentMethodName'] = 'getNullString'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [nullReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const nullReturnMutations = mutations.filter(
        m => m.mutationName === 'NullReturn'
      )
      expect(nullReturnMutations.length).toBe(0)
    })
  })
})
