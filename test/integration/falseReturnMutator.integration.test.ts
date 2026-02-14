import { ParserRuleContext } from 'antlr4ts'
import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { FalseReturnMutator } from '../../src/mutator/falseReturnMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { MutantGenerator } from '../../src/service/mutantGenerator.js'
import { TypeGatherer } from '../../src/service/typeGatherer.js'
import {
  ApexClassTypeMatcher,
  SObjectTypeMatcher,
} from '../../src/service/typeMatcher.js'
import { ApexMethod, ApexType } from '../../src/type/ApexMethod.js'

function parseApexAndGetTypeTable(code: string): Map<string, ApexMethod> {
  const typeGatherer = new TypeGatherer(
    new ApexClassTypeMatcher(new Set()),
    new SObjectTypeMatcher(new Set())
  )
  const { methodTypeTable } = typeGatherer.analyze(code)
  return methodTypeTable
}

describe('FalseReturnMutator Integration', () => {
  let mutantGenerator: MutantGenerator

  beforeEach(() => {
    mutantGenerator = new MutantGenerator()
  })

  describe('when mutating boolean return statements', () => {
    it('should create mutations for "true" boolean return values', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean isPositive(Integer value) {
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
      typeTable.set('isPositive', {
        returnType: 'Boolean',
        startLine: 3,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      const falseReturnMutator = new FalseReturnMutator()
      falseReturnMutator.setTypeTable(typeTable)
      falseReturnMutator['currentMethodName'] = 'isPositive'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [falseReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const falseReturnMutations = mutations.filter(
        m => m.mutationName === 'FalseReturnMutator'
      )
      expect(falseReturnMutations.length).toBeGreaterThan(0)

      if (falseReturnMutations.length > 0) {
        expect(falseReturnMutations[0].replacement).toBe('false')

        const result = mutantGenerator.mutate(falseReturnMutations[0])
        expect(result).toContain('return false;')
        expect(result).not.toContain('return true;')
      }
    })

    it('should create mutations for complex boolean expressions', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean checkValue(Integer value) {
              return value > 0;
            }
          }
        `
      const coveredLines = new Set([4]) // "return value > 0;"

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

      const falseReturnMutator = new FalseReturnMutator()
      falseReturnMutator.setTypeTable(typeTable)
      falseReturnMutator['currentMethodName'] = 'checkValue'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [falseReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const falseReturnMutations = mutations.filter(
        m => m.mutationName === 'FalseReturnMutator'
      )
      expect(falseReturnMutations.length).toBeGreaterThan(0)

      if (falseReturnMutations.length > 0) {
        expect(falseReturnMutations[0].replacement).toBe('false')

        const result = mutantGenerator.mutate(falseReturnMutations[0])
        expect(result).toContain('return false;')
        expect(result).not.toContain('return value > 0;')
      }
    })

    it('should not create mutations for "false" boolean returns', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean isInvalid(Integer value) {
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
      typeTable.set('isInvalid', {
        returnType: 'Boolean',
        startLine: 3,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      const falseReturnMutator = new FalseReturnMutator()
      falseReturnMutator.setTypeTable(typeTable)
      falseReturnMutator['currentMethodName'] = 'isInvalid'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [falseReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const falseReturnMutations = mutations.filter(
        m => m.mutationName === 'FalseReturnMutator'
      )
      expect(falseReturnMutations.length).toBe(0)
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

      const falseReturnMutator = new FalseReturnMutator()
      falseReturnMutator.setTypeTable(typeTable)
      falseReturnMutator['currentMethodName'] = 'isAdult'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [falseReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const falseReturnMutations = mutations.filter(
        m => m.mutationName === 'FalseReturnMutator'
      )

      expect(falseReturnMutations.length).toBe(1)

      if (falseReturnMutations.length > 0) {
        const result = mutantGenerator.mutate(falseReturnMutations[0])
        expect(result).toContain('return false;')
        expect(result).not.toContain('return true;')
      }
    })
  })
})
