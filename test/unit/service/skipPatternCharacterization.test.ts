import { ConfigReader } from '../../../src/service/configReader.js'

// Golden master pinning the user-facing skip-pattern contract through the
// ConfigReader public API — substring matching, anchors, case sensitivity,
// the error-message prefix and RE2 construct rejection — engine-agnostic,
// so it must stay green unchanged across any regex-engine swap.
describe('ConfigReader.compileSkipPatterns (skip-pattern behaviour contract)', () => {
  it('Given a substring pattern, When the line contains a match anywhere, Then test returns true', () => {
    // Arrange
    const sut = ConfigReader.compileSkipPatterns(['System\\.debug'])[0]

    // Act
    const result = sut.test('        System.debug("hi");')

    // Assert
    expect(result).toBe(true)
  })

  it('Given a substring pattern, When the line does not contain a match, Then test returns false', () => {
    // Arrange
    const sut = ConfigReader.compileSkipPatterns(['System\\.debug'])[0]

    // Act
    const result = sut.test('no logging here')

    // Assert
    expect(result).toBe(false)
  })

  it('Given a start-anchored pattern, When the match starts the line after leading whitespace, Then test returns true', () => {
    // Arrange
    const sut = ConfigReader.compileSkipPatterns(['^\\s*System'])[0]

    // Act
    const result = sut.test('    System.debug(x)')

    // Assert
    expect(result).toBe(true)
  })

  it('Given an end-anchored pattern, When the match ends the line, Then test returns true', () => {
    // Arrange
    const sut = ConfigReader.compileSkipPatterns(['System$'])[0]

    // Act
    const result = sut.test('   call System')

    // Assert
    expect(result).toBe(true)
  })

  it('Given a pattern, When the line differs only by case, Then test returns false as matching is case-sensitive by default', () => {
    // Arrange
    const sut = ConfigReader.compileSkipPatterns(['System'])[0]

    // Act
    const result = sut.test('call system.debug')

    // Assert
    expect(result).toBe(false)
  })

  it('Given a digit character-class pattern, When the line contains digits, Then test returns true', () => {
    // Arrange
    const sut = ConfigReader.compileSkipPatterns(['\\d+'])[0]

    // Act
    const result = sut.test('Integer x = 42;')

    // Assert
    expect(result).toBe(true)
  })

  it('Given a unicode literal pattern, When the line contains the unicode text, Then test returns true', () => {
    // Arrange
    const sut = ConfigReader.compileSkipPatterns(['café'])[0]

    // Act
    const result = sut.test('un café ici')

    // Assert
    expect(result).toBe(true)
  })

  it('Given one compiled pattern reused across lines, When testing several distinct lines, Then each result is correct for its own line', () => {
    // Arrange
    const sut = ConfigReader.compileSkipPatterns(['System\\.debug'])[0]

    // Act
    const results = [
      sut.test('System.debug(a);'),
      sut.test('no match here'),
      sut.test('System.debug(b);'),
    ]

    // Assert
    expect(results).toEqual([true, false, true])
  })

  it("Given an invalid pattern, When compiling, Then throws with the stable 'Invalid skip pattern' message prefix", () => {
    // Arrange & Act & Assert
    expect(() => ConfigReader.compileSkipPatterns(['([unclosed'])).toThrow(
      /Invalid skip pattern '\(\[unclosed':/
    )
  })

  it('Given a backreference pattern, When compiling, Then throws per the RE2 no-backreference guarantee', () => {
    // Arrange & Act & Assert
    expect(() => ConfigReader.compileSkipPatterns(['(a)\\1'])).toThrow(
      /Invalid skip pattern/
    )
  })
})
