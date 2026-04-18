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

  const parseAndMutate = async (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('other', code))
    const tokens = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokens)
    const tree = parser.compilationUnit()

    const typeRegistry = await buildTypeRegistry(code)
    const emptyReturnMutator = new EmptyReturnMutator(typeRegistry)
    const listener = new MutationListener([emptyReturnMutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(
      listener as ApexParserListener,
      tree as ParserRuleContext
    )

    return listener
      .getMutations()
      .filter(m => m.mutationName === 'EmptyReturnMutator')
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
      // tokens passed directly to mutate below

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
        const result = mutantGenerator.mutate(emptyReturnMutations[0], tokens)
        expect(result).toContain('return 0;')
        expect(result).not.toContain('return 42;')
      }
    })

    describe('Given Double return type with non-empty values, When mutating, Then creates mutation with 0.0', () => {
      it.each([
        { returnValue: '3.14', description: 'decimal literal' },
        { returnValue: 'total', description: 'variable' },
      ])('Given $description as return value', async ({ returnValue }) => {
        // Arrange
        const code = `
          public class TestClass {
            public static Double getValue() {
              return ${returnValue};
            }
          }
        `

        // Act
        const mutations = await parseAndMutate(code, new Set([4]))

        // Assert
        expect(mutations.length).toBeGreaterThan(0)
        expect(mutations[0].replacement).toBe('0.0')
      })
    })

    describe('Given Double return type with zero values, When mutating, Then skips mutation', () => {
      it.each([
        { returnValue: '0', description: 'integer zero' },
        { returnValue: '0.0', description: 'exact zero float' },
        { returnValue: '0.00', description: 'multi-zero float' },
        { returnValue: '0.000', description: 'triple-zero float' },
      ])('Given $description as return value', async ({ returnValue }) => {
        // Arrange
        const code = `
          public class TestClass {
            public static Double getValue() {
              return ${returnValue};
            }
          }
        `

        // Act
        const mutations = await parseAndMutate(code, new Set([4]))

        // Assert — zero value should not be mutated
        expect(mutations.length).toBe(0)
      })
    })

    describe('Given Decimal return type with non-empty values, When mutating, Then creates mutation with 0.0', () => {
      it.each([
        { returnValue: '99.99', description: 'decimal literal' },
        { returnValue: 'amount', description: 'variable' },
      ])('Given $description as return value', async ({ returnValue }) => {
        // Arrange
        const code = `
          public class TestClass {
            public static Decimal getValue() {
              return ${returnValue};
            }
          }
        `

        // Act
        const mutations = await parseAndMutate(code, new Set([4]))

        // Assert
        expect(mutations.length).toBeGreaterThan(0)
        expect(mutations[0].replacement).toBe('0.0')
      })
    })

    describe('Given Decimal return type with zero values, When mutating, Then skips mutation', () => {
      it.each([
        { returnValue: '0', description: 'integer zero' },
        { returnValue: '0.0', description: 'exact zero float' },
        { returnValue: '0.00', description: 'multi-zero float' },
      ])('Given $description as return value', async ({ returnValue }) => {
        // Arrange
        const code = `
          public class TestClass {
            public static Decimal getValue() {
              return ${returnValue};
            }
          }
        `

        // Act
        const mutations = await parseAndMutate(code, new Set([4]))

        // Assert
        expect(mutations.length).toBe(0)
      })
    })

    it('Given Long return type with zero integer value, When mutating, Then skips mutation', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public static Long getValue() {
            return 0;
          }
        }
      `

      // Act
      const mutations = await parseAndMutate(code, new Set([4]))

      // Assert — 0 is a zero value for Long, should be skipped
      expect(mutations.length).toBe(0)
    })

    it('Given Integer return type with non-zero value, When mutating, Then creates mutation with 0', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public static Integer getValue() {
            return 5;
          }
        }
      `

      // Act
      const mutations = await parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBeGreaterThan(0)
      expect(mutations[0].replacement).toBe('0')
    })
  })
})
