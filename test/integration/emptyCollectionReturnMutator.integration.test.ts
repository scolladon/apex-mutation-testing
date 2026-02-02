import { ParserRuleContext } from 'antlr4ts'
import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { EmptyCollectionReturnMutator } from '../../src/mutator/emptyCollectionReturnMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'
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

describe('EmptyCollectionReturnMutator Integration', () => {
  let mutantGenerator: MutantGenerator

  beforeEach(() => {
    mutantGenerator = new MutantGenerator()
  })

  describe('when mutating List return statements', () => {
    it('should create mutations for List return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static List<Account> getAccounts() {
              return [SELECT Id FROM Account];
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
      typeTable.set('getAccounts', {
        returnType: 'List<Account>',
        startLine: 3,
        endLine: 5,
        type: ApexType.LIST,
      })

      const emptyCollectionMutator = new EmptyCollectionReturnMutator()
      emptyCollectionMutator.setTypeTable(typeTable)
      emptyCollectionMutator['currentMethodName'] = 'getAccounts'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyCollectionMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyCollectionMutations = mutations.filter(
        m => m.mutationName === 'EmptyCollectionReturnMutator'
      )
      expect(emptyCollectionMutations.length).toBeGreaterThan(0)

      if (emptyCollectionMutations.length > 0) {
        expect(emptyCollectionMutations[0].replacement).toBe(
          'new List<Account>()'
        )

        // Test actual mutation
        const result = mutantGenerator.mutate(emptyCollectionMutations[0])
        expect(result).toContain('return new List<Account>();')
        expect(result).not.toContain('return [SELECT')
      }
    })

    it('should create mutations for List variable return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static List<String> getNames() {
              List<String> names = new List<String>{'John', 'Jane'};
              return names;
            }
          }
        `
      const coveredLines = new Set([5])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getNames', {
        returnType: 'List<String>',
        startLine: 3,
        endLine: 6,
        type: ApexType.LIST,
      })

      const emptyCollectionMutator = new EmptyCollectionReturnMutator()
      emptyCollectionMutator.setTypeTable(typeTable)
      emptyCollectionMutator['currentMethodName'] = 'getNames'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyCollectionMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyCollectionMutations = mutations.filter(
        m => m.mutationName === 'EmptyCollectionReturnMutator'
      )
      expect(emptyCollectionMutations.length).toBeGreaterThan(0)

      if (emptyCollectionMutations.length > 0) {
        expect(emptyCollectionMutations[0].replacement).toBe(
          'new List<String>()'
        )

        const result = mutantGenerator.mutate(emptyCollectionMutations[0])
        expect(result).toContain('return new List<String>();')
        expect(result).not.toContain('return names;')
      }
    })
  })

  describe('when mutating Set return statements', () => {
    it('should create mutations for Set return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Set<Id> getIds() {
              Set<Id> ids = new Set<Id>();
              ids.add('001000000000001');
              return ids;
            }
          }
        `
      const coveredLines = new Set([6])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getIds', {
        returnType: 'Set<Id>',
        startLine: 3,
        endLine: 7,
        type: ApexType.SET,
      })

      const emptyCollectionMutator = new EmptyCollectionReturnMutator()
      emptyCollectionMutator.setTypeTable(typeTable)
      emptyCollectionMutator['currentMethodName'] = 'getIds'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyCollectionMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyCollectionMutations = mutations.filter(
        m => m.mutationName === 'EmptyCollectionReturnMutator'
      )
      expect(emptyCollectionMutations.length).toBeGreaterThan(0)

      if (emptyCollectionMutations.length > 0) {
        expect(emptyCollectionMutations[0].replacement).toBe('new Set<Id>()')

        const result = mutantGenerator.mutate(emptyCollectionMutations[0])
        expect(result).toContain('return new Set<Id>();')
        expect(result).not.toContain('return ids;')
      }
    })
  })

  describe('when mutating Map return statements', () => {
    it('should create mutations for Map return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Map<Id, Account> getAccountMap() {
              Map<Id, Account> accountMap = new Map<Id, Account>();
              return accountMap;
            }
          }
        `
      const coveredLines = new Set([5])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getAccountMap', {
        returnType: 'Map<Id, Account>',
        startLine: 3,
        endLine: 6,
        type: ApexType.MAP,
      })

      const emptyCollectionMutator = new EmptyCollectionReturnMutator()
      emptyCollectionMutator.setTypeTable(typeTable)
      emptyCollectionMutator['currentMethodName'] = 'getAccountMap'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyCollectionMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyCollectionMutations = mutations.filter(
        m => m.mutationName === 'EmptyCollectionReturnMutator'
      )
      expect(emptyCollectionMutations.length).toBeGreaterThan(0)

      if (emptyCollectionMutations.length > 0) {
        expect(emptyCollectionMutations[0].replacement).toBe(
          'new Map<Id, Account>()'
        )

        const result = mutantGenerator.mutate(emptyCollectionMutations[0])
        expect(result).toContain('return new Map<Id, Account>();')
        expect(result).not.toContain('return accountMap;')
      }
    })
  })

  describe('when handling non-collection return types', () => {
    it('should not create mutations for String return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static String getName() {
              return 'test';
            }
          }
        `
      const coveredLines = new Set([4])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getName', {
        returnType: 'String',
        startLine: 3,
        endLine: 5,
        type: ApexType.STRING,
      })

      const emptyCollectionMutator = new EmptyCollectionReturnMutator()
      emptyCollectionMutator.setTypeTable(typeTable)
      emptyCollectionMutator['currentMethodName'] = 'getName'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyCollectionMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyCollectionMutations = mutations.filter(
        m => m.mutationName === 'EmptyCollectionReturnMutator'
      )
      expect(emptyCollectionMutations.length).toBe(0)
    })

    it('should not create mutations for Object return values', () => {
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

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getAccount', {
        returnType: 'Account',
        startLine: 3,
        endLine: 5,
        type: ApexType.OBJECT,
      })

      const emptyCollectionMutator = new EmptyCollectionReturnMutator()
      emptyCollectionMutator.setTypeTable(typeTable)
      emptyCollectionMutator['currentMethodName'] = 'getAccount'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyCollectionMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyCollectionMutations = mutations.filter(
        m => m.mutationName === 'EmptyCollectionReturnMutator'
      )
      expect(emptyCollectionMutations.length).toBe(0)
    })
  })

  describe('when handling already empty collection returns', () => {
    it('should not create mutations for already empty List returns', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static List<String> getEmpty() {
              return new List<String>();
            }
          }
        `
      const coveredLines = new Set([4])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getEmpty', {
        returnType: 'List<String>',
        startLine: 3,
        endLine: 5,
        type: ApexType.LIST,
      })

      const emptyCollectionMutator = new EmptyCollectionReturnMutator()
      emptyCollectionMutator.setTypeTable(typeTable)
      emptyCollectionMutator['currentMethodName'] = 'getEmpty'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyCollectionMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyCollectionMutations = mutations.filter(
        m => m.mutationName === 'EmptyCollectionReturnMutator'
      )
      expect(emptyCollectionMutations.length).toBe(0)
    })
  })
})
