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

  if (code.includes('getValue()')) {
    if (!typeTable.has('getValue')) {
      typeTable.set('getValue', {
        returnType: 'Integer',
        startLine: 3,
        endLine: 5,
        type: ApexType.INTEGER,
      })
    }
  }

  if (code.includes('getText()')) {
    if (!typeTable.has('getText')) {
      typeTable.set('getText', {
        returnType: 'String',
        startLine: 3,
        endLine: 5,
        type: ApexType.STRING,
      })
    }
  }

  if (code.includes('getList()')) {
    if (!typeTable.has('getList')) {
      typeTable.set('getList', {
        returnType: 'List<String>',
        startLine: 3,
        endLine: 5,
        type: ApexType.LIST,
        elementType: 'String',
      })
    }
  }

  return typeTable
}

describe('EmptyReturnMutator Integration', () => {
  let mutantGenerator: MutantGenerator

  beforeEach(() => {
    mutantGenerator = new MutantGenerator()
  })

  describe('when mutating return statements', () => {
    it('should create mutations for non-empty integer return values', () => {
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

      const typeTable = parseApexAndGetTypeTable(classContent)

      const emptyReturnMutator = new EmptyReturnMutator()
      emptyReturnMutator.setTypeTable(typeTable)
      emptyReturnMutator['currentMethodName'] = 'getValue'

      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()

      const listener = new MutationListener(
        [emptyReturnMutator],
        coveredLines,
        typeTable
      )

      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      const mutations = listener.getMutations()

      // Assert
      const emptyReturnMutations = mutations.filter(
        m => m.mutationName === 'EmptyReturn'
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
