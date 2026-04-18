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

      // Act - cover the switch statement and when-clause body lines so the
      // span-coverage check inside ExperimentalSwitchMutator admits the
      // atomic swap mutation (lines 5-10 span both when clauses).
      const mutations = parseAndMutate(code, new Set([4, 5, 6, 7, 8, 9, 10]))

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

      // Act — include when-clause lines so span coverage passes
      const mutations = parseAndMutate(code, new Set([4, 5, 6, 7, 8, 9, 10]))

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

      // Act — include when-clause lines so span coverage passes
      const mutations = parseAndMutate(code, new Set([4, 5, 6, 7, 8, 9, 10]))

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

  describe('Given Apex code with switch statement with three non-else cases', () => {
    it('Then should generate two atomic swap mutations (for adjacent pairs)', () => {
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
              when 3 {
                handle3();
              }
            }
          }
        }
      `

      // Act — include all when-clause lines so span coverage passes for
      // both adjacent pairs (1,2) and (2,3)
      const mutations = parseAndMutate(
        code,
        new Set([4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
      )

      // Assert — 2 atomic swaps: (1,2) and (2,3)
      expect(mutations.length).toBe(2)

      // First swap covers cases 1 and 2
      const swap12 = mutations.find(
        m =>
          m.target.text.includes('when1') &&
          m.target.text.includes('when2') &&
          !m.target.text.includes('when3')
      )
      expect(swap12).toBeDefined()

      // Second swap covers cases 2 and 3
      const swap23 = mutations.find(
        m =>
          m.target.text.includes('when2') &&
          m.target.text.includes('when3') &&
          !m.replacement.includes('when1')
      )
      expect(swap23).toBeDefined()
    })
  })

  describe('Given Apex code with switch line covered but when-clauses uncovered', () => {
    it('Then does not generate the atomic swap mutation (span uncovered)', () => {
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

      // Act — only the switch line is marked covered; the span of the two
      // when-clauses (lines 5-10) is entirely uncovered. H1 guard must
      // reject the atomic swap.
      const mutations = parseAndMutate(code, new Set([4]))

      // Assert — no mutations emitted because the span has zero coverage
      expect(mutations).toHaveLength(0)
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
