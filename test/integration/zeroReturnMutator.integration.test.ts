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
import { ZeroReturnMutator } from '../../src/mutator/zeroReturnMutator.js'
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

describe('ZeroReturnMutator Integration', () => {
  let mutantGenerator: MutantGenerator

  beforeEach(() => {
    mutantGenerator = new MutantGenerator()
  })

  describe('when mutating Integer return statements', () => {
    it('should create mutations for Integer return values', () => {
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
      mutantGenerator['tokenStream'] = tokens

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getCount', {
        returnType: 'Integer',
        startLine: 3,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      const zeroReturnMutator = new ZeroReturnMutator()
      zeroReturnMutator.setTypeTable(typeTable)
      zeroReturnMutator['currentMethodName'] = 'getCount'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [zeroReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const zeroReturnMutations = mutations.filter(
        m => m.mutationName === 'ZeroReturnMutator'
      )
      expect(zeroReturnMutations.length).toBeGreaterThan(0)

      if (zeroReturnMutations.length > 0) {
        expect(zeroReturnMutations[0].replacement).toBe('0')

        // Test actual mutation
        const result = mutantGenerator.mutate(zeroReturnMutations[0])
        expect(result).toContain('return 0;')
        expect(result).not.toContain('return 42;')
      }
    })

    it('should create mutations for Integer expressions', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Integer calculate(Integer a, Integer b) {
              return a + b;
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
      typeTable.set('calculate', {
        returnType: 'Integer',
        startLine: 3,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      const zeroReturnMutator = new ZeroReturnMutator()
      zeroReturnMutator.setTypeTable(typeTable)
      zeroReturnMutator['currentMethodName'] = 'calculate'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [zeroReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const zeroReturnMutations = mutations.filter(
        m => m.mutationName === 'ZeroReturnMutator'
      )
      expect(zeroReturnMutations.length).toBeGreaterThan(0)

      if (zeroReturnMutations.length > 0) {
        expect(zeroReturnMutations[0].replacement).toBe('0')

        const result = mutantGenerator.mutate(zeroReturnMutations[0])
        expect(result).toContain('return 0;')
        expect(result).not.toContain('return a + b;')
      }
    })
  })

  describe('when mutating Long return statements', () => {
    it('should create mutations for Long return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Long getBigNumber() {
              return 9999999999L;
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
      typeTable.set('getBigNumber', {
        returnType: 'Long',
        startLine: 3,
        endLine: 5,
        type: ApexType.LONG,
      })

      const zeroReturnMutator = new ZeroReturnMutator()
      zeroReturnMutator.setTypeTable(typeTable)
      zeroReturnMutator['currentMethodName'] = 'getBigNumber'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [zeroReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const zeroReturnMutations = mutations.filter(
        m => m.mutationName === 'ZeroReturnMutator'
      )
      expect(zeroReturnMutations.length).toBeGreaterThan(0)

      if (zeroReturnMutations.length > 0) {
        expect(zeroReturnMutations[0].replacement).toBe('0')

        const result = mutantGenerator.mutate(zeroReturnMutations[0])
        expect(result).toContain('return 0;')
        expect(result).not.toContain('return 9999999999L;')
      }
    })
  })

  describe('when mutating Double return statements', () => {
    it('should create mutations for Double return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Double getPi() {
              return 3.14159;
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
      typeTable.set('getPi', {
        returnType: 'Double',
        startLine: 3,
        endLine: 5,
        type: ApexType.DOUBLE,
      })

      const zeroReturnMutator = new ZeroReturnMutator()
      zeroReturnMutator.setTypeTable(typeTable)
      zeroReturnMutator['currentMethodName'] = 'getPi'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [zeroReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const zeroReturnMutations = mutations.filter(
        m => m.mutationName === 'ZeroReturnMutator'
      )
      expect(zeroReturnMutations.length).toBeGreaterThan(0)

      if (zeroReturnMutations.length > 0) {
        expect(zeroReturnMutations[0].replacement).toBe('0')

        const result = mutantGenerator.mutate(zeroReturnMutations[0])
        expect(result).toContain('return 0;')
        expect(result).not.toContain('return 3.14159;')
      }
    })
  })

  describe('when mutating Decimal return statements', () => {
    it('should create mutations for Decimal return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Decimal getAmount() {
              return 99.99;
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
      typeTable.set('getAmount', {
        returnType: 'Decimal',
        startLine: 3,
        endLine: 5,
        type: ApexType.DECIMAL,
      })

      const zeroReturnMutator = new ZeroReturnMutator()
      zeroReturnMutator.setTypeTable(typeTable)
      zeroReturnMutator['currentMethodName'] = 'getAmount'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [zeroReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const zeroReturnMutations = mutations.filter(
        m => m.mutationName === 'ZeroReturnMutator'
      )
      expect(zeroReturnMutations.length).toBeGreaterThan(0)

      if (zeroReturnMutations.length > 0) {
        expect(zeroReturnMutations[0].replacement).toBe('0')

        const result = mutantGenerator.mutate(zeroReturnMutations[0])
        expect(result).toContain('return 0;')
        expect(result).not.toContain('return 99.99;')
      }
    })
  })

  describe('when handling non-numeric return types', () => {
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

      const zeroReturnMutator = new ZeroReturnMutator()
      zeroReturnMutator.setTypeTable(typeTable)
      zeroReturnMutator['currentMethodName'] = 'getName'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [zeroReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const zeroReturnMutations = mutations.filter(
        m => m.mutationName === 'ZeroReturnMutator'
      )
      expect(zeroReturnMutations.length).toBe(0)
    })

    it('should not create mutations for Boolean return values', () => {
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

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('isValid', {
        returnType: 'Boolean',
        startLine: 3,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      const zeroReturnMutator = new ZeroReturnMutator()
      zeroReturnMutator.setTypeTable(typeTable)
      zeroReturnMutator['currentMethodName'] = 'isValid'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [zeroReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const zeroReturnMutations = mutations.filter(
        m => m.mutationName === 'ZeroReturnMutator'
      )
      expect(zeroReturnMutations.length).toBe(0)
    })
  })

  describe('when handling already zero returns', () => {
    it('should not create mutations for already zero returns', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Integer getZero() {
              return 0;
            }
          }
        `
      const coveredLines = new Set([4])

      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)

      const typeTable = parseApexAndGetTypeTable(classContent)
      typeTable.set('getZero', {
        returnType: 'Integer',
        startLine: 3,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      const zeroReturnMutator = new ZeroReturnMutator()
      zeroReturnMutator.setTypeTable(typeTable)
      zeroReturnMutator['currentMethodName'] = 'getZero'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [zeroReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const zeroReturnMutations = mutations.filter(
        m => m.mutationName === 'ZeroReturnMutator'
      )
      expect(zeroReturnMutations.length).toBe(0)
    })
  })
})
