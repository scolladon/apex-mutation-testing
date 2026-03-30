import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { UnaryOperatorInsertionMutator } from '../../src/mutator/unaryOperatorInsertionMutator.js'
import { TypeDiscoverer } from '../../src/service/typeDiscoverer.js'
import { TypeRegistry } from '../../src/type/TypeRegistry.js'

describe('UnaryOperatorInsertionMutator Integration', () => {
  const buildTypeRegistry = async (code: string) => {
    const typeDiscoverer = new TypeDiscoverer()
    return typeDiscoverer.analyze(code)
  }

  const parseAndMutate = (
    code: string,
    coveredLines: Set<number>,
    typeRegistry?: TypeRegistry
  ) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const mutator = new UnaryOperatorInsertionMutator(typeRegistry)
    const listener = new MutationListener([mutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with a variable reference in a return statement', () => {
    it('Then should generate only 2 pre-op mutations (++x, --x), skipping equivalent post-op (x++, x--)', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            Integer x = 5;
            return x;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert — post-op (x++, x--) are equivalent in return context: return x++ returns the
      // pre-increment value, identical to return x. Only pre-op mutations are meaningful.
      const uoiMutations = mutations.filter(
        m => m.mutationName === 'UnaryOperatorInsertionMutator'
      )
      expect(uoiMutations.length).toBe(2)
      expect(uoiMutations.map(m => m.replacement)).toEqual(
        expect.arrayContaining(['++x', '--x'])
      )
    })
  })

  describe('Given Apex code with a variable reference outside a return statement', () => {
    it('Then should generate all 4 mutations (x++, ++x, x--, --x)', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            Integer x = 5;
            Integer y = x;
            return y;
          }
        }
      `
      // Line 5: Integer y = x — x is used in an assignment initializer, not inside a return

      // Act
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert — x is used in an assignment, not a return: all 4 mutations are non-equivalent
      const uoiMutations = mutations.filter(
        m => m.mutationName === 'UnaryOperatorInsertionMutator'
      )
      expect(uoiMutations.length).toBe(4)
      expect(uoiMutations.map(m => m.replacement)).toEqual(
        expect.arrayContaining(['x++', '++x', 'x--', '--x'])
      )
    })
  })

  describe('Given Apex code with a literal', () => {
    it('Then should NOT generate mutations for numeric literals', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return 42;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      const uoiMutations = mutations.filter(
        m => m.mutationName === 'UnaryOperatorInsertionMutator'
      )
      expect(uoiMutations.length).toBe(0)
    })
  })

  describe('Given Apex code with variable on uncovered line', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            Integer x = 5;
            return x;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      const uoiMutations = mutations.filter(
        m => m.mutationName === 'UnaryOperatorInsertionMutator'
      )
      expect(uoiMutations.length).toBe(0)
    })
  })

  describe('Given Apex code with a dot method call on a variable', () => {
    it('Then should NOT generate UOI mutations for the receiver', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public String test() {
            String result = 'hello';
            return result.toLowerCase();
          }
        }
      `
      const typeRegistry = await buildTypeRegistry(code)

      // Act
      const mutations = parseAndMutate(code, new Set([5]), typeRegistry)

      // Assert
      const uoiMutations = mutations.filter(
        m => m.mutationName === 'UnaryOperatorInsertionMutator'
      )
      expect(uoiMutations.length).toBe(0)
    })
  })

  describe('Given Apex code with throw statement containing method call', () => {
    it('Then should NOT generate UOI mutations', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            try {
              doSomething();
            } catch (Exception e) {
              throw new AuraHandledException(e.getMessage());
            }
          }
        }
      `
      const typeRegistry = await buildTypeRegistry(code)

      // Act
      const mutations = parseAndMutate(code, new Set([7]), typeRegistry)

      // Assert
      const uoiMutations = mutations.filter(
        m => m.mutationName === 'UnaryOperatorInsertionMutator'
      )
      expect(uoiMutations.length).toBe(0)
    })
  })

  describe('Given Apex code with a non-numeric variable', () => {
    it('Then should NOT generate UOI mutations for String variable', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public String test() {
            String s = 'test';
            return s;
          }
        }
      `
      const typeRegistry = await buildTypeRegistry(code)

      // Act
      const mutations = parseAndMutate(code, new Set([5]), typeRegistry)

      // Assert
      const uoiMutations = mutations.filter(
        m => m.mutationName === 'UnaryOperatorInsertionMutator'
      )
      expect(uoiMutations.length).toBe(0)
    })
  })

  describe('Given Apex code with a numeric variable and TypeRegistry in a return statement', () => {
    it('Then should generate only 2 pre-op mutations (++x, --x)', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            Integer x = 5;
            return x;
          }
        }
      `
      const typeRegistry = await buildTypeRegistry(code)

      // Act
      const mutations = parseAndMutate(code, new Set([5]), typeRegistry)

      // Assert — post-op mutations are skipped in return context regardless of TypeRegistry
      const uoiMutations = mutations.filter(
        m => m.mutationName === 'UnaryOperatorInsertionMutator'
      )
      expect(uoiMutations.length).toBe(2)
      expect(uoiMutations.map(m => m.replacement)).toEqual(
        expect.arrayContaining(['++x', '--x'])
      )
    })
  })

  describe('Given Apex code with a variable but no TypeRegistry in a return statement', () => {
    it('Then should generate 2 pre-op mutations (permissive fallback, post-op skipped in return)', () => {
      // Arrange
      const code = `
        public class TestClass {
          public String test() {
            String s = 'test';
            return s;
          }
        }
      `

      // Act — no TypeRegistry passed
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert — permissive: pre-op mutations still generated; post-op skipped as equivalent in return
      const uoiMutations = mutations.filter(
        m => m.mutationName === 'UnaryOperatorInsertionMutator'
      )
      expect(uoiMutations.length).toBe(2)
      expect(uoiMutations.map(m => m.replacement)).toEqual(
        expect.arrayContaining(['++s', '--s'])
      )
    })
  })
})
