import {
  isLineSkipped,
  isLineWithinAllowed,
} from '../../../src/service/lineEligibility.js'
import { compileSkipPattern } from '../../../src/service/skipPattern.js'

// The real RE2JS adapter, not a fake: the range guard in isLineSkipped exists
// because RE2JS.test(undefined) THROWS on an out-of-range index rather than
// failing to match. A fake with `line.includes(...)` would throw too, but for
// a different reason, and would not pin the shipped behaviour.
const SOURCE_LINES = ['public class Foo {', '  System.debug(bar);', '}']

describe('isLineWithinAllowed', () => {
  describe('when no line range was requested', () => {
    describe('given any line', () => {
      it('then should admit it', () => {
        // Arrange
        const sut = isLineWithinAllowed

        // Act & Assert
        expect(sut(42, undefined)).toBe(true)
      })
    })
  })

  describe('when a line range was requested', () => {
    describe('given a line inside it', () => {
      it('then should admit it', () => {
        // Arrange
        const sut = isLineWithinAllowed

        // Act & Assert
        expect(sut(10, new Set([10, 11]))).toBe(true)
      })
    })

    describe('given a line outside it', () => {
      it('then should reject it', () => {
        // Arrange
        const sut = isLineWithinAllowed

        // Act & Assert
        expect(sut(12, new Set([10, 11]))).toBe(false)
      })
    })
  })
})

describe('isLineSkipped', () => {
  describe('when no skip pattern is configured', () => {
    it('then should skip nothing', () => {
      // Arrange
      const sut = isLineSkipped

      // Act & Assert
      expect(sut(2, [], SOURCE_LINES)).toBe(false)
    })
  })

  describe('when a skip pattern is configured', () => {
    describe('given a matching line', () => {
      it('then should skip it', () => {
        // Arrange
        const sut = isLineSkipped

        // Act & Assert
        expect(
          sut(2, [compileSkipPattern('System\\.debug')], SOURCE_LINES)
        ).toBe(true)
      })
    })

    describe('given a non-matching line', () => {
      it('then should keep it', () => {
        // Arrange
        const sut = isLineSkipped

        // Act & Assert
        expect(
          sut(1, [compileSkipPattern('System\\.debug')], SOURCE_LINES)
        ).toBe(false)
      })
    })

    describe('given the last line of the source', () => {
      it('then should still read it', () => {
        // Arrange — line === sourceLines.length is the inclusive upper bound;
        // an off-by-one guard would stop reading the final line entirely.
        const sut = isLineSkipped

        // Act & Assert
        expect(
          sut(SOURCE_LINES.length, [compileSkipPattern('\\}')], SOURCE_LINES)
        ).toBe(true)
      })
    })

    describe('given a line past the end of the source', () => {
      it('then should report it unskipped instead of throwing', () => {
        // Arrange — RE2JS.test(undefined) throws, so an unguarded index would
        // replace the caller's diagnostic with a TypeError stack.
        const sut = isLineSkipped

        // Act & Assert
        expect(
          sut(
            SOURCE_LINES.length + 1,
            [compileSkipPattern('System\\.debug')],
            SOURCE_LINES
          )
        ).toBe(false)
      })
    })

    describe('given a non-positive line', () => {
      it('then should report it unskipped instead of throwing', () => {
        // Arrange — the walker never asks about line 0, but the diagnosis
        // iterates org-supplied covered lines with no bounds check.
        const sut = isLineSkipped

        // Act & Assert
        expect(
          sut(0, [compileSkipPattern('System\\.debug')], SOURCE_LINES)
        ).toBe(false)
      })
    })
  })
})
