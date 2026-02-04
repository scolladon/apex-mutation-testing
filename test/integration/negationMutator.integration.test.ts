import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { NegationMutator } from '../../src/mutator/negationMutator.js'

describe('NegationMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const negationMutator = new NegationMutator()
    const listener = new MutationListener([negationMutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with return statement returning variable', () => {
    it('Then should generate mutation to negate the variable', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return x;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('-x')
      expect(mutations[0].mutationName).toBe('NegationMutator')
    })
  })

  describe('Given Apex code with return statement returning numeric literal', () => {
    it('Then should generate mutation to negate the literal', () => {
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
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('-42')
    })
  })

  describe('Given Apex code with return statement already negated', () => {
    it('Then should not generate mutation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return -x;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with multiple return statements', () => {
    it('Then should generate mutations for each eligible return', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test(Boolean condition) {
            if (condition) {
              return x;
            }
            return y;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([5, 7]))

      // Assert
      expect(mutations.length).toBe(2)
      expect(mutations[0].replacement).toBe('-x')
      expect(mutations[1].replacement).toBe('-y')
    })
  })

  describe('Given Apex code with return statement returning boolean', () => {
    it('Then should not generate mutation for true', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Boolean test() {
            return true;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })

    it('Then should not generate mutation for false', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Boolean test() {
            return false;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with return statement returning null', () => {
    it('Then should not generate mutation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Object test() {
            return null;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with return statement returning string', () => {
    it('Then should not generate mutation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public String test() {
            return 'hello';
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with void return', () => {
    it('Then should not generate mutation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            return;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with return on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return x;
          }
        }
      `

      // Act - line 4 is not covered
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with return statement returning expression', () => {
    it('Then should generate mutation to negate the expression', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a + b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('-a+b')
    })
  })
})
