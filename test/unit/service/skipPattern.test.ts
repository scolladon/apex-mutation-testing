import { compileSkipPattern } from '../../../src/service/skipPattern.js'

describe('compileSkipPattern', () => {
  it('Given a substring pattern, When the line contains a match anywhere, Then test returns true', () => {
    // Arrange
    const sut = compileSkipPattern('System\\.debug')

    // Act
    const result = sut.test('        System.debug("x");')

    // Assert
    expect(result).toBe(true)
  })

  it('Given a substring pattern, When the line does not contain a match, Then test returns false', () => {
    // Arrange
    const sut = compileSkipPattern('System\\.debug')

    // Act
    const result = sut.test('no logging here')

    // Assert
    expect(result).toBe(false)
  })

  it('Given a start-anchored pattern, When the match starts the line, Then test returns true', () => {
    // Arrange
    const sut = compileSkipPattern('^\\s*System')

    // Act
    const result = sut.test('    System.debug(x)')

    // Assert
    expect(result).toBe(true)
  })

  it('Given a pattern, When the line differs only by case, Then test returns false as matching is case-sensitive by default', () => {
    // Arrange
    const sut = compileSkipPattern('System')

    // Act
    const result = sut.test('system.debug(x)')

    // Assert
    expect(result).toBe(false)
  })

  it('Given one compiled pattern reused across lines, When testing several distinct lines, Then each result is correct for its own line', () => {
    // Arrange
    const sut = compileSkipPattern('System\\.debug')

    // Act
    const results = [
      sut.test('System.debug(a);'),
      sut.test('no match here'),
      sut.test('System.debug(b);'),
    ]

    // Assert
    expect(results).toEqual([true, false, true])
  })

  it('Given an invalid pattern, When compiling, Then throws with the engine parse-error prefix', () => {
    // Arrange & Act & Assert
    expect(() => compileSkipPattern('([unclosed')).toThrow(
      /error parsing regexp/
    )
  })

  it('Given a backreference pattern, When compiling, Then throws per the RE2 no-backreference guarantee', () => {
    // Arrange & Act & Assert
    expect(() => compileSkipPattern('(a)\\1')).toThrow(/error parsing regexp/)
  })

  it('Given several patterns compiled once, When matched over a large synthetic class, Then compile+match completes well within budget', () => {
    // Arrange — generous, non-flaking budget: ~1000x the empirically pinned
    // ~1ms cost, so this only guards against a catastrophic regression.
    const patterns = [
      'System\\.debug',
      '^\\s*//',
      'Test\\.startTest',
      '\\d{3,}',
      'Database\\.query',
    ]
    const syntheticClass = Array(4000).fill('    System.debug(x);').join('\n')
    const lines = syntheticClass.split('\n')

    // Act
    const start = performance.now()
    const compiled = patterns.map(pattern => compileSkipPattern(pattern))
    for (const pattern of compiled) {
      for (const line of lines) {
        pattern.test(line)
      }
    }
    const elapsedMs = performance.now() - start

    // Assert
    expect(elapsedMs).toBeLessThan(1000)
  })
})
