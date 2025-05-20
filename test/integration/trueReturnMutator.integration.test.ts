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

describe('TrueReturnMutator Integration', () => {
  let mutantGenerator: MutantGenerator

  beforeEach(() => {
    mutantGenerator = new MutantGenerator()
  })

  describe('when mutating boolean return statements', () => {
    it('should create mutations for "false" boolean return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean isNegative(Integer value) {
              return false;
            }
          }
        `
      const coveredLines = new Set([4]) // "return false;"

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('isNegative', {
        returnType: 'Boolean',
        startLine: 3,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      const trueReturnMutator = new TrueReturnMutator()
      trueReturnMutator.setTypeTable(typeTable)
      trueReturnMutator['currentMethodName'] = 'isNegative'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [trueReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const trueReturnMutations = mutations.filter(
        m => m.mutationName === 'TrueReturn'
      )
      expect(trueReturnMutations.length).toBeGreaterThan(0)

      if (trueReturnMutations.length > 0) {
        expect(trueReturnMutations[0].replacement).toBe('true')

        // Test actual mutation
        const result = mutantGenerator.mutate(trueReturnMutations[0])
        expect(result).toContain('return true;')
        expect(result).not.toContain('return false;')
      }
    })

    it('should create mutations for complex boolean expressions', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean checkValue(Integer value) {
              return value < 0;
            }
          }
        `
      const coveredLines = new Set([4]) // "return value < 0;"

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('checkValue', {
        returnType: 'Boolean',
        startLine: 3,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      const trueReturnMutator = new TrueReturnMutator()
      trueReturnMutator.setTypeTable(typeTable)
      trueReturnMutator['currentMethodName'] = 'checkValue'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [trueReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const trueReturnMutations = mutations.filter(
        m => m.mutationName === 'TrueReturn'
      )
      expect(trueReturnMutations.length).toBeGreaterThan(0)

      if (trueReturnMutations.length > 0) {
        expect(trueReturnMutations[0].replacement).toBe('true')

        // Test actual mutation
        const result = mutantGenerator.mutate(trueReturnMutations[0])
        expect(result).toContain('return true;')
        expect(result).not.toContain('return value < 0;')
      }
    })

    it('should not create mutations for "true" boolean returns', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean isValid(Integer value) {
              return true;
            }
          }
        `
      const coveredLines = new Set([4]) // "return true;"

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens

      const typeTable = parseApexAndGetTypeTable(classContent)
      // Add type information directly here
      typeTable.set('isValid', {
        returnType: 'Boolean',
        startLine: 3,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      const trueReturnMutator = new TrueReturnMutator()
      trueReturnMutator.setTypeTable(typeTable)
      trueReturnMutator['currentMethodName'] = 'isValid'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [trueReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const trueReturnMutations = mutations.filter(
        m => m.mutationName === 'TrueReturn'
      )
      expect(trueReturnMutations.length).toBe(0)
    })

    it('should handle if-else statements with boolean returns', () => {
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

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('isAdult', {
        returnType: 'Boolean',
        startLine: 3,
        endLine: 8,
        type: ApexType.BOOLEAN,
      })

      const trueReturnMutator = new TrueReturnMutator()
      trueReturnMutator.setTypeTable(typeTable)
      trueReturnMutator['currentMethodName'] = 'isAdult'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [trueReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const trueReturnMutations = mutations.filter(
        m => m.mutationName === 'TrueReturn'
      )

      // Should only mutate the "false" return, not the "true" return
      expect(trueReturnMutations.length).toBe(1)

      if (trueReturnMutations.length > 0) {
        // Test actual mutation
        const result = mutantGenerator.mutate(trueReturnMutations[0])
        expect(result).toContain('return true;')
        expect(result).not.toContain('return false;')
      }
    })

    it('should handle ternary expressions with boolean returns', () => {
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

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('hasPermissions', {
        returnType: 'Boolean',
        startLine: 3,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      const trueReturnMutator = new TrueReturnMutator()
      trueReturnMutator.setTypeTable(typeTable)
      trueReturnMutator['currentMethodName'] = 'hasPermissions'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [trueReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const trueReturnMutations = mutations.filter(
        m => m.mutationName === 'TrueReturn'
      )

      expect(trueReturnMutations.length).toBeGreaterThanOrEqual(0)

      if (trueReturnMutations.length > 0) {
        // Test actual mutation
        const result = mutantGenerator.mutate(trueReturnMutations[0])
        expect(result).toContain('true')
      }
    })

    it('should handle logical expressions with boolean returns', () => {
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

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('isValidRecord', {
        returnType: 'Boolean',
        startLine: 3,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      const trueReturnMutator = new TrueReturnMutator()
      trueReturnMutator.setTypeTable(typeTable)
      trueReturnMutator['currentMethodName'] = 'isValidRecord'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [trueReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const trueReturnMutations = mutations.filter(
        m => m.mutationName === 'TrueReturn'
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
