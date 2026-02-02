import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { SwitchMutator } from '../../src/mutator/switchMutator.js'

describe('SwitchMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const switchMutator = new SwitchMutator()
    const listener = new MutationListener([switchMutator], coveredLines)

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with switch statement with multiple cases', () => {
    it('Then should generate mutations for each when clause', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test(Integer value) {
            switch on value {
              when 1 {
                handle1();
              }
              when 2 {
                handle2();
              }
              when else {
                handleDefault();
              }
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([5, 8, 11]))

      // Assert
      expect(mutations.length).toBe(3) // One for each when clause
      mutations.forEach(m => {
        expect(m.replacement).toBe('{}')
        expect(m.mutationName).toBe('SwitchMutator')
      })
    })
  })

  describe('Given Apex code with switch statement with single case', () => {
    it('Then should generate mutation for the case', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test(Integer value) {
            switch on value {
              when 1 {
                doSomething();
              }
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([5]))

      // Assert
      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('{}')
    })
  })

  describe('Given Apex code with switch on SObject type', () => {
    it('Then should generate mutations for type cases', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test(SObject obj) {
            switch on obj {
              when Account acc {
                handleAccount(acc);
              }
              when Contact con {
                handleContact(con);
              }
              when else {
                handleOther();
              }
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([5, 8, 11]))

      // Assert
      expect(mutations.length).toBe(3)
    })
  })

  describe('Given Apex code with switch statement on uncovered lines', () => {
    it('Then should not generate mutations', () => {
      // Arrange
      const code = `
        public class TestClass {
          public void test(Integer value) {
            switch on value {
              when 1 {
                handle1();
              }
            }
          }
        }
      `

      // Act - when clause is not covered
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })

  describe('Given Apex code with switch on enum', () => {
    it('Then should generate mutations for enum cases', () => {
      // Arrange
      const code = `
        public class TestClass {
          public enum Status { ACTIVE, INACTIVE }
          public void test(Status s) {
            switch on s {
              when ACTIVE {
                handleActive();
              }
              when INACTIVE {
                handleInactive();
              }
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([6, 9]))

      // Assert
      expect(mutations.length).toBe(2)
    })
  })
})
