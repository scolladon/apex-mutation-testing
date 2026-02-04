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
      // 1 remove-else + 1 duplicate-first-into-else + 1 atomic swap (swaps both values at once)
      expect(mutations.length).toBe(3)

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

      // Check atomic swap mutation - swaps both when clauses at once to avoid
      // compilation errors from duplicate switch values
      const atomicSwapMutation = mutations.find(
        m =>
          m.target.text.includes('when1') &&
          m.target.text.includes('when2') &&
          m.replacement.includes('when 2') &&
          m.replacement.includes('when 1')
      )
      expect(atomicSwapMutation).toBeDefined()
    })
  })

  describe('Given Apex code with switch statement without else', () => {
    it('Then should only generate atomic swap mutation', () => {
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

      // Assert - only 1 atomic swap mutation (no remove-else or duplicate)
      expect(mutations.length).toBe(1)
      expect(mutations.every(m => m.replacement !== '')).toBe(true)

      // Verify it's an atomic swap
      const atomicSwapMutation = mutations[0]
      expect(atomicSwapMutation.target.text).toContain('when1')
      expect(atomicSwapMutation.target.text).toContain('when2')
    })
  })

  describe('Given Apex code with switch on SObject type', () => {
    it('Then should generate atomic swap mutation for type cases', () => {
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
      // 1 remove-else + 1 duplicate + 1 atomic swap for type cases
      expect(mutations.length).toBe(3)

      // Check atomic swap mutation swaps both type declarations at once
      const atomicSwapMutation = mutations.find(
        m =>
          m.target.text.includes('Accountacc') &&
          m.target.text.includes('Contactcon')
      )
      expect(atomicSwapMutation).toBeDefined()
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
