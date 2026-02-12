import { ParserRuleContext } from 'antlr4ts'
import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { ArithmeticOperatorMutator } from '../../src/mutator/arithmeticOperatorMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { ApexTypeResolver } from '../../src/service/apexTypeResolver.js'

describe('ArithmeticOperatorMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const arithmeticOperatorMutator = new ArithmeticOperatorMutator()
    const listener = new MutationListener(
      [arithmeticOperatorMutator],
      coveredLines
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  const parseAndMutateTypeAware = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const resolver = new ApexTypeResolver()
    const typeTable = resolver.analyzeMethodTypes(tree as ParserRuleContext)

    const arithmeticOperatorMutator = new ArithmeticOperatorMutator()
    const listener = new MutationListener(
      [arithmeticOperatorMutator],
      coveredLines,
      typeTable
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with addition operator', () => {
    it('Then should generate mutations replacing addition with other operators', () => {
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
      expect(mutations.length).toBe(3)
      expect(mutations[0].replacement).toBe('-')
      expect(mutations[1].replacement).toBe('*')
      expect(mutations[2].replacement).toBe('/')
      expect(mutations[0].mutationName).toBe('ArithmeticOperatorMutator')
    })
  })

  describe('Given Apex code with subtraction operator', () => {
    it('Then should generate mutations replacing subtraction with other operators', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a - b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(3)
      const replacements = mutations.map(m => m.replacement)
      expect(replacements).toContain('+')
      expect(replacements).toContain('*')
      expect(replacements).toContain('/')
    })
  })

  describe('Given Apex code with multiplication operator', () => {
    it('Then should generate mutations replacing multiplication with other operators', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a * b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(3)
      const replacements = mutations.map(m => m.replacement)
      expect(replacements).toContain('+')
      expect(replacements).toContain('-')
      expect(replacements).toContain('/')
    })
  })

  describe('Given Apex code with division operator', () => {
    it('Then should generate mutations replacing division with other operators', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a / b;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(3)
      const replacements = mutations.map(m => m.replacement)
      expect(replacements).toContain('+')
      expect(replacements).toContain('-')
      expect(replacements).toContain('*')
    })
  })

  describe('Given Apex code with arithmetic on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a + b;
          }
        }
      `

      // Act - line 4 is not covered
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with arithmetic in assignment', () => {
    it('Then should generate mutations for the arithmetic operator', () => {
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
      expect(mutations.length).toBe(3)
      const replacements = mutations.map(m => m.replacement)
      expect(replacements).toContain('+')
      expect(replacements).toContain('-')
      expect(replacements).toContain('/')
    })
  })

  describe('Given Apex code with multiple arithmetic operators', () => {
    it('Then should generate mutations for each operator', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a + b - c;
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      // 3 mutations for + and 3 for -
      expect(mutations.length).toBe(6)
    })
  })

  describe('Given type-aware parsing with string concatenation', () => {
    it('Then should suppress + mutations for string literal concatenation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public String test() {
            return 'hello' + 'world';
          }
        }
      `

      // Act
      const mutations = parseAndMutateTypeAware(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })

    it('Then should suppress + mutations for String variable concatenation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public String test() {
            String a = 'x';
            String b = 'y';
            return a + b;
          }
        }
      `

      // Act
      const mutations = parseAndMutateTypeAware(code, new Set([4, 5, 6]))

      // Assert
      expect(mutations.length).toBe(0)
    })

    it('Then should suppress + mutations for mixed string literal concatenation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public String test() {
            Integer count = 5;
            return count + ' items';
          }
        }
      `

      // Act
      const mutations = parseAndMutateTypeAware(code, new Set([4, 5]))

      // Assert
      expect(mutations.length).toBe(0)
    })

    it('Then should suppress + mutations for String method parameter concatenation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public String test(String param) {
            return param + 'suffix';
          }
        }
      `

      // Act
      const mutations = parseAndMutateTypeAware(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })

    it('Then should suppress + mutations for String field concatenation', () => {
      // Arrange
      const code = `
        public class TestClass {
          String label;
          public String test() {
            return label + 'suffix';
          }
        }
      `

      // Act
      const mutations = parseAndMutateTypeAware(code, new Set([5]))

      // Assert
      expect(mutations.length).toBe(0)
    })

    it('Then should suppress + mutations for String method call return concatenation', () => {
      // Arrange
      const code = `
        public class TestClass {
          public String getString() {
            return 'hello';
          }
          public String test() {
            return getString() + 'x';
          }
        }
      `

      // Act
      const mutations = parseAndMutateTypeAware(code, new Set([7]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given type-aware parsing with numeric addition', () => {
    it('Then should generate mutations for Integer variable addition', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            Integer a = 1;
            Integer b = 2;
            return a + b;
          }
        }
      `

      // Act
      const mutations = parseAndMutateTypeAware(code, new Set([4, 5, 6]))

      // Assert
      expect(mutations.length).toBe(3)
    })

    it('Then should generate mutations for numeric literal addition', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return 1 + 2;
          }
        }
      `

      // Act
      const mutations = parseAndMutateTypeAware(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(3)
    })
  })

  describe('Given type-aware parsing with non-addition operators', () => {
    it('Then should always mutate subtraction regardless of operand types', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a - b;
          }
        }
      `

      // Act
      const mutations = parseAndMutateTypeAware(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(3)
    })

    it('Then should always mutate multiplication regardless of operand types', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a * b;
          }
        }
      `

      // Act
      const mutations = parseAndMutateTypeAware(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(3)
    })

    it('Then should always mutate division regardless of operand types', () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer test() {
            return a / b;
          }
        }
      `

      // Act
      const mutations = parseAndMutateTypeAware(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(3)
    })
  })
})
