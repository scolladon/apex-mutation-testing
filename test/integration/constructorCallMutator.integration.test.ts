import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { ConstructorCallMutator } from '../../src/mutator/constructorCallMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'

describe('ConstructorCallMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const constructorCallMutator = new ConstructorCallMutator()
    const listener = new MutationListener(
      [constructorCallMutator],
      coveredLines
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with simple constructor call', () => {
    it('Then should generate mutation replacing with null', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Account acc = new Account();
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('null')
      expect(mutations[0].mutationName).toBe('ConstructorCallMutator')
    })
  })

  describe('Given Apex code with generic type constructor', () => {
    it('Then should generate mutation replacing with null', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            List<String> items = new List<String>();
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('null')
    })
  })

  describe('Given Apex code with constructor with arguments', () => {
    it('Then should generate mutation replacing with null', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Account acc = new Account(Name = 'Test');
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('null')
    })
  })

  describe('Given Apex code with multiple constructor calls', () => {
    it('Then should generate mutations for each constructor', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Account acc = new Account();
            Contact con = new Contact();
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4, 5]))

      // Assert
      expect(mutations.length).toBe(2)
      expect(mutations[0].replacement).toBe('null')
      expect(mutations[1].replacement).toBe('null')
    })
  })

  describe('Given Apex code with Map constructor', () => {
    it('Then should generate mutation replacing with null', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Map<String, Object> data = new Map<String, Object>();
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('null')
    })
  })

  describe('Given Apex code with Set constructor', () => {
    it('Then should generate mutation replacing with null', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Set<Id> ids = new Set<Id>();
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('null')
    })
  })

  describe('Given Apex code with constructor on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            Account acc = new Account();
          }
        }
      `

      // Act - line 4 is not covered
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with nested constructor calls', () => {
    it('Then should generate mutations for inner constructors', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test() {
            insert new Account(Name = 'Test');
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('null')
    })
  })
})
