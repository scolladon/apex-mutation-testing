import { ParserRuleContext } from 'antlr4ts'
import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { EmptyStringReturnMutator } from '../../src/mutator/emptyStringReturnMutator.js'
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

describe('EmptyStringReturnMutator Integration', () => {
  let mutantGenerator: MutantGenerator

  beforeEach(() => {
    mutantGenerator = new MutantGenerator()
  })

  describe('when mutating String return statements', () => {
    it('should create mutations for String literal return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static String getName() {
              return 'John Doe';
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

      const emptyStringReturnMutator = new EmptyStringReturnMutator()
      emptyStringReturnMutator.setTypeTable(typeTable)
      emptyStringReturnMutator['currentMethodName'] = 'getName'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyStringReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyStringMutations = mutations.filter(
        m => m.mutationName === 'EmptyStringReturnMutator'
      )
      expect(emptyStringMutations.length).toBeGreaterThan(0)

      if (emptyStringMutations.length > 0) {
        expect(emptyStringMutations[0].replacement).toBe("''")

        // Test actual mutation
        const result = mutantGenerator.mutate(emptyStringMutations[0])
        expect(result).toContain("return '';")
        expect(result).not.toContain("return 'John Doe';")
      }
    })

    it('should create mutations for String variable return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static String getMessage() {
              String msg = 'Hello World';
              return msg;
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
      typeTable.set('getMessage', {
        returnType: 'String',
        startLine: 3,
        endLine: 6,
        type: ApexType.STRING,
      })

      const emptyStringReturnMutator = new EmptyStringReturnMutator()
      emptyStringReturnMutator.setTypeTable(typeTable)
      emptyStringReturnMutator['currentMethodName'] = 'getMessage'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyStringReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyStringMutations = mutations.filter(
        m => m.mutationName === 'EmptyStringReturnMutator'
      )
      expect(emptyStringMutations.length).toBeGreaterThan(0)

      if (emptyStringMutations.length > 0) {
        expect(emptyStringMutations[0].replacement).toBe("''")

        const result = mutantGenerator.mutate(emptyStringMutations[0])
        expect(result).toContain("return '';")
        expect(result).not.toContain('return msg;')
      }
    })

    it('should create mutations for String concatenation return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static String getFullName(String first, String last) {
              return first + ' ' + last;
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
      typeTable.set('getFullName', {
        returnType: 'String',
        startLine: 3,
        endLine: 5,
        type: ApexType.STRING,
      })

      const emptyStringReturnMutator = new EmptyStringReturnMutator()
      emptyStringReturnMutator.setTypeTable(typeTable)
      emptyStringReturnMutator['currentMethodName'] = 'getFullName'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyStringReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyStringMutations = mutations.filter(
        m => m.mutationName === 'EmptyStringReturnMutator'
      )
      expect(emptyStringMutations.length).toBeGreaterThan(0)

      if (emptyStringMutations.length > 0) {
        expect(emptyStringMutations[0].replacement).toBe("''")

        const result = mutantGenerator.mutate(emptyStringMutations[0])
        expect(result).toContain("return '';")
      }
    })
  })

  describe('when handling non-String return types', () => {
    it('should not create mutations for Integer return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Integer getCount() {
              return 42;
            }
          }
        `
      const coveredLines = new Set([4])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getCount', {
        returnType: 'Integer',
        startLine: 3,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      const emptyStringReturnMutator = new EmptyStringReturnMutator()
      emptyStringReturnMutator.setTypeTable(typeTable)
      emptyStringReturnMutator['currentMethodName'] = 'getCount'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyStringReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyStringMutations = mutations.filter(
        m => m.mutationName === 'EmptyStringReturnMutator'
      )
      expect(emptyStringMutations.length).toBe(0)
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

      const emptyStringReturnMutator = new EmptyStringReturnMutator()
      emptyStringReturnMutator.setTypeTable(typeTable)
      emptyStringReturnMutator['currentMethodName'] = 'getAccount'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyStringReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyStringMutations = mutations.filter(
        m => m.mutationName === 'EmptyStringReturnMutator'
      )
      expect(emptyStringMutations.length).toBe(0)
    })
  })

  describe('when handling already empty string returns', () => {
    it('should not create mutations for already empty string returns', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static String getEmpty() {
              return '';
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
        returnType: 'String',
        startLine: 3,
        endLine: 5,
        type: ApexType.STRING,
      })

      const emptyStringReturnMutator = new EmptyStringReturnMutator()
      emptyStringReturnMutator.setTypeTable(typeTable)
      emptyStringReturnMutator['currentMethodName'] = 'getEmpty'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyStringReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyStringMutations = mutations.filter(
        m => m.mutationName === 'EmptyStringReturnMutator'
      )
      expect(emptyStringMutations.length).toBe(0)
    })
  })
})
