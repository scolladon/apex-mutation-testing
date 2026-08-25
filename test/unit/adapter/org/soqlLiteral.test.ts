import {
  assertSoqlLiteralSafe,
  escapeSoqlLiteral,
  toSoqlLiteralList,
} from '../../../../src/adapter/org/soqlLiteral.js'

describe('escapeSoqlLiteral', () => {
  describe('when the value carries neither a quote nor a backslash', () => {
    it('then should return it unchanged', () => {
      // Arrange
      const sut = escapeSoqlLiteral

      // Act
      const result = sut('MyClass')

      // Assert
      expect(result).toBe('MyClass')
    })
  })

  describe('when the value carries a quote', () => {
    it('then should escape it so the literal cannot be closed', () => {
      // Arrange
      const sut = escapeSoqlLiteral

      // Act
      const result = sut("O'Brien")

      // Assert
      expect(result).toBe("O\\'Brien")
    })
  })

  describe('when the value carries a backslash', () => {
    it('then should double it before any quote is escaped', () => {
      // Arrange
      const sut = escapeSoqlLiteral

      // Act
      const result = sut('a\\b')

      // Assert
      expect(result).toBe('a\\\\b')
    })
  })

  describe('when the value ends on a backslash followed by a quote', () => {
    it('then should not let the trailing backslash escape the escaped quote', () => {
      // Arrange
      const sut = escapeSoqlLiteral

      // Act
      const result = sut("a\\' OR Name != '")

      // Assert
      // Doubling first is what makes this safe: the payload's own backslash
      // becomes a literal backslash, so the quote after it stays escaped.
      expect(result).toBe("a\\\\\\' OR Name != \\'")
    })
  })
})

describe('toSoqlLiteralList', () => {
  describe('when given several values', () => {
    it('then should quote and comma-join them', () => {
      // Arrange
      const sut = toSoqlLiteralList

      // Act
      const result = sut(['Alpha', 'Beta'])

      // Assert
      expect(result).toBe("'Alpha', 'Beta'")
    })
  })

  describe('when given a value carrying a quote', () => {
    it('then should escape it inside its quotes', () => {
      // Arrange
      const sut = toSoqlLiteralList

      // Act
      const result = sut(["O'Brien"])

      // Assert
      expect(result).toBe("'O\\'Brien'")
    })
  })
})

describe('assertSoqlLiteralSafe', () => {
  describe('when the value carries neither a quote nor a backslash', () => {
    it('then should return it unchanged', () => {
      // Arrange
      const sut = assertSoqlLiteralSafe

      // Act
      const result = sut('MyNamespace.MyClass')

      // Assert
      expect(result).toBe('MyNamespace.MyClass')
    })
  })

  describe('when the value carries a backslash', () => {
    it('then should throw rather than reach a builder that leaves it raw', () => {
      // Arrange
      const sut = assertSoqlLiteralSafe

      // Act
      const act = () => sut('a\\b')

      // Assert
      expect(act).toThrow(/backslash/i)
    })
  })

  describe('when the value carries a quote', () => {
    it('then should throw rather than reach a builder that leaves it raw', () => {
      // Arrange
      const sut = assertSoqlLiteralSafe

      // Act
      const act = () => sut("a' OR Name != '")

      // Assert
      expect(act).toThrow(/quote/i)
    })
  })

  describe('when the rejected value is attacker-shaped text', () => {
    it('then should not repeat it in the message it throws', () => {
      // Arrange
      const sut = assertSoqlLiteralSafe

      // Act
      const act = () => sut("payload' OR Name != '")

      // Assert
      // The rejected value is attacker-shaped text; echoing it back into a
      // message the CLI prints would make this guard its own output sink.
      expect(act).toThrow(expect.not.stringContaining('payload'))
    })
  })
})
