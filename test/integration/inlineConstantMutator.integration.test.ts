import { ParserRuleContext } from 'antlr4ts'
import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { InlineConstantMutator } from '../../src/mutator/inlineConstantMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { MutantGenerator } from '../../src/service/mutantGenerator.js'
import { APEX_TYPE } from '../../src/type/ApexMethod.js'
import { TypeRegistry } from '../../src/type/TypeRegistry.js'

describe('InlineConstantMutator Integration', () => {
  let mutantGenerator: MutantGenerator

  beforeEach(() => {
    mutantGenerator = new MutantGenerator()
  })

  describe('when mutating integer literals', () => {
    it('should create CRCR mutations and produce valid mutated source', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Integer getAnswer() {
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
      const inlineConstantMutator = new InlineConstantMutator()
      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()
      const listener = new MutationListener(
        [inlineConstantMutator],
        coveredLines
      )
      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      // Act
      const mutations = listener.getMutations()

      // Assert
      const intMutations = mutations.filter(
        m => m.mutationName === 'InlineConstantMutator'
      )
      expect(intMutations.length).toBe(5)
      const zeroMutation = intMutations.find(m => m.replacement === '0')
      expect(zeroMutation).toBeDefined()
      const result = mutantGenerator.mutate(zeroMutation!)
      expect(result).toContain('return 0;')
      expect(result).not.toContain('return 42;')
    })
  })

  describe('when mutating long literals', () => {
    it('should create CRCR mutations with L suffix and produce valid mutated source', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Long getBigNumber() {
              return 42L;
            }
          }
        `
      const coveredLines = new Set([4])
      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens
      const inlineConstantMutator = new InlineConstantMutator()
      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()
      const listener = new MutationListener(
        [inlineConstantMutator],
        coveredLines
      )
      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      // Act
      const mutations = listener.getMutations()

      // Assert
      const longMutations = mutations.filter(
        m => m.mutationName === 'InlineConstantMutator'
      )
      expect(longMutations).toHaveLength(5)
      const zeroMutation = longMutations.find(m => m.replacement === '0L')
      expect(zeroMutation).toBeDefined()
      const result = mutantGenerator.mutate(zeroMutation!)
      expect(result).toContain('return 0L;')
      expect(result).not.toContain('return 42L;')
    })
  })

  describe('when mutating number literals', () => {
    it('should create CRCR mutations with decimal and produce valid mutated source', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Double getPi() {
              return 3.14;
            }
          }
        `
      const coveredLines = new Set([4])
      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens
      const inlineConstantMutator = new InlineConstantMutator()
      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()
      const listener = new MutationListener(
        [inlineConstantMutator],
        coveredLines
      )
      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      // Act
      const mutations = listener.getMutations()

      // Assert
      const numMutations = mutations.filter(
        m => m.mutationName === 'InlineConstantMutator'
      )
      expect(numMutations).toHaveLength(5)
      const zeroMutation = numMutations.find(m => m.replacement === '0.0')
      expect(zeroMutation).toBeDefined()
      const result = mutantGenerator.mutate(zeroMutation!)
      expect(result).toContain('return 0.0;')
      expect(result).not.toContain('return 3.14;')
    })
  })

  describe('when mutating null literal in local variable declaration', () => {
    it('should replace null with type-appropriate default', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static void doWork() {
              Integer x = null;
            }
          }
        `
      const coveredLines = new Set([4])
      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens
      const typeRegistry = new TypeRegistry(new Map(), new Map(), new Map(), [])
      const inlineConstantMutator = new InlineConstantMutator(typeRegistry)
      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()
      const listener = new MutationListener(
        [inlineConstantMutator],
        coveredLines
      )
      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      // Act
      const mutations = listener.getMutations()

      // Assert
      const nullMutations = mutations.filter(
        m => m.mutationName === 'InlineConstantMutator'
      )
      expect(nullMutations).toHaveLength(1)
      expect(nullMutations[0].replacement).toBe('0')
      const result = mutantGenerator.mutate(nullMutations[0])
      expect(result).toContain('Integer x = 0;')
      expect(result).not.toContain('Integer x = null;')
    })
  })

  describe('when mutating string literals', () => {
    it('should replace non-empty string with empty and produce valid mutated source', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static String greet() {
              return 'Hello World';
            }
          }
        `
      const coveredLines = new Set([4])
      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens
      const inlineConstantMutator = new InlineConstantMutator()
      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()
      const listener = new MutationListener(
        [inlineConstantMutator],
        coveredLines
      )
      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      // Act
      const mutations = listener.getMutations()

      // Assert
      const strMutations = mutations.filter(
        m => m.mutationName === 'InlineConstantMutator'
      )
      expect(strMutations).toHaveLength(1)
      expect(strMutations[0].replacement).toBe("''")
      const result = mutantGenerator.mutate(strMutations[0])
      expect(result).toContain("return '';")
      expect(result).not.toContain("return 'Hello World';")
    })
  })

  describe('when mutating boolean literals', () => {
    it('should flip true to false and produce valid mutated source', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Boolean isEnabled() {
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
      const inlineConstantMutator = new InlineConstantMutator()
      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()
      const listener = new MutationListener(
        [inlineConstantMutator],
        coveredLines
      )
      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      // Act
      const mutations = listener.getMutations()

      // Assert
      const boolMutations = mutations.filter(
        m => m.mutationName === 'InlineConstantMutator'
      )
      expect(boolMutations).toHaveLength(1)
      expect(boolMutations[0].replacement).toBe('false')
      const result = mutantGenerator.mutate(boolMutations[0])
      expect(result).toContain('return false;')
      expect(result).not.toContain('return true;')
    })
  })

  describe('when mutating multiple literals in one class', () => {
    it('should create mutations for all literals on covered lines', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static void doWork() {
              Integer count = 10;
              String name = 'test';
              Boolean active = true;
            }
          }
        `
      const coveredLines = new Set([4, 5, 6])
      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens
      const inlineConstantMutator = new InlineConstantMutator()
      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()
      const listener = new MutationListener(
        [inlineConstantMutator],
        coveredLines
      )
      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      // Act
      const mutations = listener.getMutations()

      // Assert
      // 5 for integer (CRCR of 10) + 1 for string + 1 for boolean = 7
      expect(mutations.length).toBe(7)
    })
  })

  describe('when mutating null literal in return statement with TypeRegistry', () => {
    it('should replace null with type-appropriate default and produce valid mutated source', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static Integer getVal() {
              return null;
            }
          }
        `
      const coveredLines = new Set([4])
      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens
      const typeRegistry = new TypeRegistry(
        new Map([
          [
            'getVal',
            {
              returnType: 'Integer',
              startLine: 3,
              endLine: 5,
              type: APEX_TYPE.INTEGER,
            },
          ],
        ]),
        new Map(),
        new Map(),
        []
      )
      const inlineConstantMutator = new InlineConstantMutator(typeRegistry)
      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()
      const listener = new MutationListener(
        [inlineConstantMutator],
        coveredLines
      )
      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      // Act
      const mutations = listener.getMutations()

      // Assert
      const nullMutations = mutations.filter(
        m => m.mutationName === 'InlineConstantMutator'
      )
      expect(nullMutations).toHaveLength(1)
      expect(nullMutations[0].replacement).toBe('0')
      const result = mutantGenerator.mutate(nullMutations[0])
      expect(result).toContain('return 0;')
      expect(result).not.toContain('return null;')
    })
  })

  describe('when mutating null literal in final local variable declaration', () => {
    it('should replace null with type-appropriate default despite final modifier', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static void doWork() {
              final Integer result = null;
            }
          }
        `
      const coveredLines = new Set([4])
      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens
      const typeRegistry = new TypeRegistry(new Map(), new Map(), new Map(), [])
      const inlineConstantMutator = new InlineConstantMutator(typeRegistry)
      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()
      const listener = new MutationListener(
        [inlineConstantMutator],
        coveredLines
      )
      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      // Act
      const mutations = listener.getMutations()

      // Assert
      const nullMutations = mutations.filter(
        m => m.mutationName === 'InlineConstantMutator'
      )
      expect(nullMutations).toHaveLength(1)
      expect(nullMutations[0].replacement).toBe('0')
      const result = mutantGenerator.mutate(nullMutations[0])
      expect(result).toContain('final Integer result = 0;')
      expect(result).not.toContain('final Integer result = null;')
    })
  })

  describe('when mutating null literal in final field declaration', () => {
    it('should replace null with type-appropriate default despite final modifier', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            private final String name = null;
          }
        `
      const coveredLines = new Set([3])
      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens
      const typeRegistry = new TypeRegistry(new Map(), new Map(), new Map(), [])
      const inlineConstantMutator = new InlineConstantMutator(typeRegistry)
      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()
      const listener = new MutationListener(
        [inlineConstantMutator],
        coveredLines
      )
      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      // Act
      const mutations = listener.getMutations()

      // Assert
      const nullMutations = mutations.filter(
        m => m.mutationName === 'InlineConstantMutator'
      )
      expect(nullMutations).toHaveLength(1)
      expect(nullMutations[0].replacement).toBe("''")
      const result = mutantGenerator.mutate(nullMutations[0])
      expect(result).toContain("private final String name = '';")
      expect(result).not.toContain('private final String name = null;')
    })
  })

  describe('when mutating null literal in static final field declaration', () => {
    it('should replace null with type-appropriate default despite static final modifiers', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            private static final Integer COUNT = null;
          }
        `
      const coveredLines = new Set([3])
      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      mutantGenerator['tokenStream'] = tokens
      const typeRegistry = new TypeRegistry(new Map(), new Map(), new Map(), [])
      const inlineConstantMutator = new InlineConstantMutator(typeRegistry)
      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()
      const listener = new MutationListener(
        [inlineConstantMutator],
        coveredLines
      )
      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      // Act
      const mutations = listener.getMutations()

      // Assert
      const nullMutations = mutations.filter(
        m => m.mutationName === 'InlineConstantMutator'
      )
      expect(nullMutations).toHaveLength(1)
      expect(nullMutations[0].replacement).toBe('0')
      const result = mutantGenerator.mutate(nullMutations[0])
      expect(result).toContain('private static final Integer COUNT = 0;')
      expect(result).not.toContain('private static final Integer COUNT = null;')
    })
  })

  describe('when literal is on uncovered line', () => {
    it('should not create mutations', () => {
      // Arrange
      const classContent = `
          public class TestClass {
            public static void doWork() {
              Integer count = 42;
            }
          }
        `
      const coveredLines = new Set([99])
      const lexer = new ApexLexer(
        new CaseInsensitiveInputStream('other', classContent)
      )
      const tokens = new CommonTokenStream(lexer)
      const inlineConstantMutator = new InlineConstantMutator()
      const parser = new ApexParser(tokens)
      const tree = parser.compilationUnit()
      const listener = new MutationListener(
        [inlineConstantMutator],
        coveredLines
      )
      ParseTreeWalker.DEFAULT.walk(
        listener as ApexParserListener,
        tree as ParserRuleContext
      )

      // Act
      const mutations = listener.getMutations()

      // Assert
      expect(mutations).toHaveLength(0)
    })
  })
})
