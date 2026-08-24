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
    it('then should admit every line', () => {
      // Arrange
      const sut = isLineWithinAllowed

      // Act & Assert
      expect(sut(42, undefined)).toBe(true)
    })
  })

  describe('when a line range was requested', () => {
    it('then should admit a line inside it and reject one outside', () => {
      // Arrange
      const sut = isLineWithinAllowed
      const allowed = new Set([10, 11])

      // Act & Assert
      expect(sut(10, allowed)).toBe(true)
      expect(sut(12, allowed)).toBe(false)
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
    it('then should skip a matching line and keep a non-matching one', () => {
      // Arrange
      const sut = isLineSkipped
      const patterns = [compileSkipPattern('System\\.debug')]

      // Act & Assert
      expect(sut(2, patterns, SOURCE_LINES)).toBe(true)
      expect(sut(1, patterns, SOURCE_LINES)).toBe(false)
    })

    it('then should still read the last line of the source', () => {
      // Arrange — line === sourceLines.length is the inclusive upper bound;
      // an off-by-one guard would stop reading the final line entirely.
      const sut = isLineSkipped
      const patterns = [compileSkipPattern('\\}')]

      // Act & Assert
      expect(sut(SOURCE_LINES.length, patterns, SOURCE_LINES)).toBe(true)
    })
  })

  describe('when the line falls outside the source', () => {
    it('then should report it unskipped instead of throwing', () => {
      // Arrange — RE2JS.test(undefined) throws, so an unguarded index would
      // replace the caller's diagnostic with a TypeError stack.
      const sut = isLineSkipped
      const patterns = [compileSkipPattern('System\\.debug')]

      // Act & Assert
      expect(sut(SOURCE_LINES.length + 1, patterns, SOURCE_LINES)).toBe(false)
      expect(sut(0, patterns, SOURCE_LINES)).toBe(false)
    })
  })
})
