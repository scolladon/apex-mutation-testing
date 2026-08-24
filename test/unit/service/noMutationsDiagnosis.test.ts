import { diagnoseNoMutations } from '../../../src/service/noMutationsDiagnosis.js'
import type { SkipPattern } from '../../../src/service/skipPattern.js'

// A skip pattern is a port, so a fake is enough — the real RE2JS engine is
// pinned by skipPattern.test.ts and would only add coupling here.
const matching = (needle: string): SkipPattern => ({
  test: (line: string) => line.includes(needle),
})

const SOURCE_LINES = [
  'public class Foo {', // line 1
  '  System.debug(bar);', // line 2
  '  if (a == b) {', // line 3
  '  }', // line 4
  '}', // line 5
]

describe('diagnoseNoMutations', () => {
  describe('when a line range is requested', () => {
    describe('given no covered line falls inside it', () => {
      it('then should blame the line range and report the covered total', () => {
        // Arrange
        const sut = diagnoseNoMutations

        // Act
        const result = sut({
          coveredLines: new Set([2, 3]),
          allowedLines: new Set([90, 91]),
          skipPatterns: [],
          sourceLines: SOURCE_LINES,
          mutatorFilterActive: false,
        })

        // Assert
        expect(result).toEqual({ reason: 'line-range', coveredCount: 2 })
      })
    })

    describe('given at least one covered line falls inside it', () => {
      it('then should not blame the line range', () => {
        // Arrange
        const sut = diagnoseNoMutations

        // Act
        const result = sut({
          coveredLines: new Set([2, 3]),
          allowedLines: new Set([3, 90]),
          skipPatterns: [],
          sourceLines: SOURCE_LINES,
          mutatorFilterActive: false,
        })

        // Assert
        expect(result).toEqual({
          reason: 'no-mutable-pattern',
          coveredCount: 2,
        })
      })
    })
  })

  describe('when skip patterns are configured', () => {
    describe('given they match every in-range covered line', () => {
      it('then should blame the skip patterns and report the in-range total', () => {
        // Arrange
        const sut = diagnoseNoMutations

        // Act
        const result = sut({
          coveredLines: new Set([2]),
          allowedLines: undefined,
          skipPatterns: [matching('System.debug')],
          sourceLines: SOURCE_LINES,
          mutatorFilterActive: false,
        })

        // Assert
        expect(result).toEqual({ reason: 'skip-patterns', inRangeCount: 1 })
      })
    })

    describe('given at least one in-range covered line survives them', () => {
      it('then should not blame the skip patterns', () => {
        // Arrange
        const sut = diagnoseNoMutations

        // Act
        const result = sut({
          coveredLines: new Set([2, 3]),
          allowedLines: undefined,
          skipPatterns: [matching('System.debug')],
          sourceLines: SOURCE_LINES,
          mutatorFilterActive: false,
        })

        // Assert
        expect(result).toEqual({
          reason: 'no-mutable-pattern',
          coveredCount: 2,
        })
      })
    })

    describe('given a covered line lies beyond the end of the source', () => {
      it('then should treat it as surviving rather than skipped', () => {
        // Arrange
        const sut = diagnoseNoMutations

        // Act
        const result = sut({
          coveredLines: new Set([99]),
          allowedLines: undefined,
          skipPatterns: [matching('System.debug')],
          sourceLines: SOURCE_LINES,
          mutatorFilterActive: false,
        })

        // Assert
        expect(result).toEqual({
          reason: 'no-mutable-pattern',
          coveredCount: 1,
        })
      })
    })
  })

  describe('when a mutator filter is active', () => {
    describe('given eligible lines remain', () => {
      it('then should blame the mutator filter and report the eligible total', () => {
        // Arrange
        const sut = diagnoseNoMutations

        // Act
        const result = sut({
          coveredLines: new Set([2, 3]),
          allowedLines: undefined,
          skipPatterns: [matching('System.debug')],
          sourceLines: SOURCE_LINES,
          mutatorFilterActive: true,
        })

        // Assert
        expect(result).toEqual({ reason: 'mutator-filter', eligibleCount: 1 })
      })
    })

    describe('given the line range already emptied the candidate set', () => {
      it('then should blame the line range instead', () => {
        // Arrange
        const sut = diagnoseNoMutations

        // Act
        const result = sut({
          coveredLines: new Set([2, 3]),
          allowedLines: new Set([90]),
          skipPatterns: [],
          sourceLines: SOURCE_LINES,
          mutatorFilterActive: true,
        })

        // Assert
        expect(result).toEqual({ reason: 'line-range', coveredCount: 2 })
      })
    })
  })

  describe('when no filter is configured', () => {
    describe('given covered lines exist but nothing mutated', () => {
      it('then should report that no mutable pattern was found', () => {
        // Arrange
        const sut = diagnoseNoMutations

        // Act
        const result = sut({
          coveredLines: new Set([1, 3, 5]),
          allowedLines: undefined,
          skipPatterns: [],
          sourceLines: SOURCE_LINES,
          mutatorFilterActive: false,
        })

        // Assert
        expect(result).toEqual({
          reason: 'no-mutable-pattern',
          coveredCount: 3,
        })
      })
    })
  })
})
