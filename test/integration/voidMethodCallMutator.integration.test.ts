import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { VoidMethodCallMutator } from '../../src/mutator/voidMethodCallMutator.js'

describe('VoidMethodCallMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const voidMethodCallMutator = new VoidMethodCallMutator()
    const listener = new MutationListener([voidMethodCallMutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with System.debug call', () => {
    it('Then should generate mutation to remove the call', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            System.debug('test');
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('')
      expect(mutations[0].mutationName).toBe('VoidMethodCallMutator')
    })
  })

  describe('Given Apex code with simple method call', () => {
    it('Then should generate mutation to remove the call', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            doSomething();
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('')
    })
  })

  describe('Given Apex code with object method call', () => {
    it('Then should generate mutation to remove the call', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            someLogger.log('message');
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('')
    })
  })

  describe('Given Apex code with multiple void method calls', () => {
    it('Then should generate mutations for each call', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            System.debug('start');
            doSomething();
            System.debug('end');
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4, 5, 6]))

      // Assert
      expect(mutations.length).toBe(3)
    })
  })

  describe('Given Apex code with assignment (not void call)', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Integer x = getValue();
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with return statement', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return getValue();
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with void call on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            System.debug('test');
          }
        }
      `

      // Act - line 4 is not covered
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with DML operations', () => {
    it('Then should generate mutation for insert call', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            insert account;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert - DML is handled differently, not as expression statement
      // This tests that we don't crash on DML
      expect(mutations.length).toBe(0)
    })
  })
})
