import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { LogicalOperatorDeletionMutator } from '../../src/mutator/logicalOperatorDeletionMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'

describe('LogicalOperatorDeletionMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const mutator = new LogicalOperatorDeletionMutator()
    const listener = new MutationListener([mutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with && and non-identity operands', () => {
    it('Then should generate 2 mutations: left operand and right operand', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (a && b) {
              doSomething();
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations).toHaveLength(2)
      expect(mutations[0].replacement).toBe('a')
      expect(mutations[1].replacement).toBe('b')
      expect(mutations[0].mutationName).toBe('LogicalOperatorDeletionMutator')
    })
  })

  describe('Given Apex code with && where right operand is true (identity)', () => {
    it('Then should generate only 1 mutation: left operand (skipping equivalent → left)', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (a && true) {
              doSomething();
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert — a && true = a, so → a would be equivalent
      expect(mutations).toHaveLength(1)
      expect(mutations[0].replacement).toBe('true')
    })
  })

  describe('Given Apex code with && where left operand is true (identity)', () => {
    it('Then should generate only 1 mutation: right operand (skipping equivalent → right)', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (true && b) {
              doSomething();
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert — true && b = b, so → b would be equivalent
      expect(mutations).toHaveLength(1)
      expect(mutations[0].replacement).toBe('true')
    })
  })

  describe('Given Apex code with || and non-identity operands', () => {
    it('Then should generate 2 mutations: left operand and right operand', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (x || y) {
              doSomething();
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations).toHaveLength(2)
      expect(mutations[0].replacement).toBe('x')
      expect(mutations[1].replacement).toBe('y')
    })
  })

  describe('Given Apex code with || where right operand is false (identity)', () => {
    it('Then should generate only 1 mutation: left operand (skipping equivalent → left)', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (x || false) {
              doSomething();
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert — x || false = x, so → x would be equivalent
      expect(mutations).toHaveLength(1)
      expect(mutations[0].replacement).toBe('false')
    })
  })

  describe('Given Apex code with || where left operand is false (identity)', () => {
    it('Then should generate only 1 mutation: right operand (skipping equivalent → right)', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (false || y) {
              doSomething();
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert — false || y = y, so → y would be equivalent
      expect(mutations).toHaveLength(1)
      expect(mutations[0].replacement).toBe('false')
    })
  })

  describe('Given Apex code with logical operators on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            if (a && b) {
              doSomething();
            }
          }
        }
      `

      // Act — line 4 not covered
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert
      expect(mutations).toHaveLength(0)
    })
  })
})
