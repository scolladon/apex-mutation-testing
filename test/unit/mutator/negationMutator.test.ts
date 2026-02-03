import { ParserRuleContext, Token } from 'antlr4ts'
import { NegationMutator } from '../../../src/mutator/negationMutator.js'

describe('NegationMutator', () => {
  let sut: NegationMutator

  beforeEach(() => {
    sut = new NegationMutator()
  })

  describe('Given a return statement with a variable', () => {
    describe('When entering the statement', () => {
      it('Then should create mutation to negate the value', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        const expressionCtx = {
          text: 'x',
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3, // 'return', expression, ';'
          getChild: jest.fn().mockImplementation(index => {
            if (index === 1) return expressionCtx
            return { text: index === 0 ? 'return' : ';' }
          }),
          start: mockToken,
          stop: { tokenIndex: 7 } as Token,
          text: 'return x;',
          expression: jest.fn().mockReturnValue(expressionCtx),
        } as unknown as ParserRuleContext

        // Act
        sut.enterReturnStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('-x')
        expect(sut._mutations[0].mutationName).toBe('NegationMutator')
      })
    })
  })

  describe('Given a return statement with a numeric literal', () => {
    describe('When entering the statement', () => {
      it('Then should create mutation to negate the value', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        const expressionCtx = {
          text: '5',
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: jest.fn().mockImplementation(index => {
            if (index === 1) return expressionCtx
            return { text: index === 0 ? 'return' : ';' }
          }),
          start: mockToken,
          stop: { tokenIndex: 7 } as Token,
          text: 'return 5;',
          expression: jest.fn().mockReturnValue(expressionCtx),
        } as unknown as ParserRuleContext

        // Act
        sut.enterReturnStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('-5')
      })
    })
  })

  describe('Given a return statement that already has negation', () => {
    describe('When entering the statement', () => {
      it('Then should not create mutation (avoid double negation)', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        const expressionCtx = {
          text: '-x',
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: jest.fn().mockImplementation(index => {
            if (index === 1) return expressionCtx
            return { text: index === 0 ? 'return' : ';' }
          }),
          start: mockToken,
          stop: { tokenIndex: 7 } as Token,
          text: 'return -x;',
          expression: jest.fn().mockReturnValue(expressionCtx),
        } as unknown as ParserRuleContext

        // Act
        sut.enterReturnStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an empty return statement', () => {
    describe('When entering the statement', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 2, // 'return', ';'
          getChild: jest.fn(),
          expression: jest.fn().mockReturnValue(null),
        } as unknown as ParserRuleContext

        // Act
        sut.enterReturnStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a return statement with a string literal', () => {
    describe('When entering the statement', () => {
      it('Then should not create mutation', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        const expressionCtx = {
          text: "'hello'",
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: jest.fn().mockImplementation(index => {
            if (index === 1) return expressionCtx
            return { text: index === 0 ? 'return' : ';' }
          }),
          start: mockToken,
          stop: { tokenIndex: 7 } as Token,
          text: "return 'hello';",
          expression: jest.fn().mockReturnValue(expressionCtx),
        } as unknown as ParserRuleContext

        // Act
        sut.enterReturnStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a return statement with a boolean', () => {
    describe('When entering the statement', () => {
      it('Then should not create mutation for true', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        const expressionCtx = {
          text: 'true',
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: jest.fn().mockImplementation(index => {
            if (index === 1) return expressionCtx
            return { text: index === 0 ? 'return' : ';' }
          }),
          start: mockToken,
          stop: { tokenIndex: 7 } as Token,
          text: 'return true;',
          expression: jest.fn().mockReturnValue(expressionCtx),
        } as unknown as ParserRuleContext

        // Act
        sut.enterReturnStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then should not create mutation for false', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        const expressionCtx = {
          text: 'false',
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: jest.fn().mockImplementation(index => {
            if (index === 1) return expressionCtx
            return { text: index === 0 ? 'return' : ';' }
          }),
          start: mockToken,
          stop: { tokenIndex: 7 } as Token,
          text: 'return false;',
          expression: jest.fn().mockReturnValue(expressionCtx),
        } as unknown as ParserRuleContext

        // Act
        sut.enterReturnStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a return statement with null', () => {
    describe('When entering the statement', () => {
      it('Then should not create mutation', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        const expressionCtx = {
          text: 'null',
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: jest.fn().mockImplementation(index => {
            if (index === 1) return expressionCtx
            return { text: index === 0 ? 'return' : ';' }
          }),
          start: mockToken,
          stop: { tokenIndex: 7 } as Token,
          text: 'return null;',
          expression: jest.fn().mockReturnValue(expressionCtx),
        } as unknown as ParserRuleContext

        // Act
        sut.enterReturnStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })
})
