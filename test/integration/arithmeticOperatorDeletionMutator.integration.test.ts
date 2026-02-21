import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { ArithmeticOperatorDeletionMutator } from '../../src/mutator/arithmeticOperatorDeletionMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { TypeDiscoverer } from '../../src/service/typeDiscoverer.js'
import { ApexClassTypeMatcher } from '../../src/service/typeMatcher.js'

describe('ArithmeticOperatorDeletionMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const mutator = new ArithmeticOperatorDeletionMutator()
    const listener = new MutationListener([mutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  const parseAndMutateTypeAware = async (
    code: string,
    coveredLines: Set<number>
  ) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const typeDiscoverer = new TypeDiscoverer().withMatcher(
      new ApexClassTypeMatcher(new Set())
    )
    const typeRegistry = await typeDiscoverer.analyze(code)

    const mutator = new ArithmeticOperatorDeletionMutator(typeRegistry)
    const listener = new MutationListener([mutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with a + b', () => {
    it('Then should generate two mutations: a and b', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer result = a + b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(2)
      expect(mutations[0].replacement).toBe('a')
      expect(mutations[1].replacement).toBe('b')
      expect(mutations[0].mutationName).toBe(
        'ArithmeticOperatorDeletionMutator'
      )
    })
  })

  describe('Given Apex code with string concatenation', () => {
    it('Then should NOT generate mutations for string + string', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            String result = 'hello' + 'world';
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with multiplication', () => {
    it('Then should generate two mutations for a * b', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer result = x * y;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(2)
      expect(mutations[0].replacement).toBe('x')
      expect(mutations[1].replacement).toBe('y')
    })
  })

  describe('Given Apex code with arithmetic on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer result = a + b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given type-aware mode with String variable addition', () => {
    it('Then should NOT generate mutations for String concatenation', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            String name = 'hello';
            String result = name + ' world';
          }
        }
      `

      // Act
      const mutations = await parseAndMutateTypeAware(code, new Set([5]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given type-aware mode with Integer variable addition', () => {
    it('Then should generate mutations for numeric addition', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer a = 1;
            Integer b = 2;
            Integer result = a + b;
          }
        }
      `

      // Act
      const mutations = await parseAndMutateTypeAware(code, new Set([6]))

      // Assert
      expect(mutations.length).toBe(2)
      expect(mutations[0].replacement).toBe('a')
      expect(mutations[1].replacement).toBe('b')
    })
  })
})
