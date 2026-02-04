import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { ExperimentalSwitchMutator } from '../../src/mutator/experimentalSwitchMutator.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'

describe('ExperimentalSwitchMutator Integration', () => {
  const parseAndMutate = (code: string, coveredLines: Set<number>) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const experimentalSwitchMutator = new ExperimentalSwitchMutator()
    const listener = new MutationListener(
      [experimentalSwitchMutator],
      coveredLines
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('Given Apex code with switch statement with multiple cases and else', () => {
    it('Then should generate all experimental mutations', () => {
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

      // Act - cover the switch statement line
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      // 1 remove-else + 1 duplicate-first-into-else + 2 swap (1↔2 and 2↔1)
      expect(mutations.length).toBe(4)

      // Check remove-else mutation (text has no spaces in ANTLR)
      const removeMutation = mutations.find(m => m.replacement === '')
      expect(removeMutation).toBeDefined()
      expect(removeMutation?.target.text).toContain('whenelse')

      // Check duplicate-first-into-else mutation
      const duplicateMutation = mutations.find(
        m => m.replacement === '{handle1();}'
      )
      expect(duplicateMutation).toBeDefined()
      expect(duplicateMutation?.target.text).toBe('{handleDefault();}')

      // Check swap mutations
      const swap1To2 = mutations.find(
        m => m.target.text === '1' && m.replacement === '2'
      )
      expect(swap1To2).toBeDefined()

      const swap2To1 = mutations.find(
        m => m.target.text === '2' && m.replacement === '1'
      )
      expect(swap2To1).toBeDefined()
    })
  })

  describe('Given Apex code with switch statement without else', () => {
    it('Then should only generate swap mutations', () => {
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
            }
          }
        }
      `

      // Act
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert - only swap mutations (no remove-else or duplicate)
      expect(mutations.length).toBe(2)
      expect(mutations.every(m => m.replacement !== '')).toBe(true)
    })
  })

  describe('Given Apex code with switch on SObject type', () => {
    it('Then should generate swap mutations for type cases', () => {
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
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert
      // 1 remove-else + 1 duplicate + 2 swap type cases
      expect(mutations.length).toBe(4)

      // Check swap mutations swap the full type declaration (no spaces in ANTLR text)
      const swapAccountToContact = mutations.find(
        m => m.target.text === 'Accountacc' && m.replacement === 'Contactcon'
      )
      expect(swapAccountToContact).toBeDefined()
    })
  })

  describe('Given Apex code with switch on uncovered line', () => {
    it('Then should not generate mutations', () => {
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
            }
          }
        }
      `

      // Act - switch line not covered
      const mutations = parseAndMutate(code, new Set([10]))

      // Assert
      expect(mutations.length).toBe(0)
    })
  })
})
