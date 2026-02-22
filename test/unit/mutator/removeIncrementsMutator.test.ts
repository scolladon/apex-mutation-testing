import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { RemoveIncrementsMutator } from '../../../src/mutator/removeIncrementsMutator.js'

describe('RemoveIncrementsMutator', () => {
  let sut: RemoveIncrementsMutator

  beforeEach(() => {
    sut = new RemoveIncrementsMutator()
  })

  describe('Given a PostOpExpression with post-increment (i++)', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation removing the increment', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        const innerExpression = {
          text: 'i',
          start: mockToken,
          stop: { tokenIndex: 5 } as Token,
        } as unknown as ParserRuleContext

        const operatorNode = new TerminalNode({ text: '++' } as Token)

        const ctx = {
          childCount: 2,
          getChild: jest.fn().mockImplementation(index => {
            return index === 0 ? innerExpression : operatorNode
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'i++',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('i')
        expect(sut._mutations[0].mutationName).toBe('RemoveIncrementsMutator')
      })
    })
  })

  describe('Given a PostOpExpression with post-decrement (i--)', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation removing the decrement', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        const innerExpression = {
          text: 'j',
          start: mockToken,
          stop: { tokenIndex: 5 } as Token,
        } as unknown as ParserRuleContext

        const operatorNode = new TerminalNode({ text: '--' } as Token)

        const ctx = {
          childCount: 2,
          getChild: jest.fn().mockImplementation(index => {
            return index === 0 ? innerExpression : operatorNode
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'j--',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('j')
      })
    })
  })

  describe('Given a PreOpExpression with pre-increment (++i)', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation removing the increment', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        const operatorNode = new TerminalNode({ text: '++' } as Token)

        const innerExpression = {
          text: 'i',
          start: { tokenIndex: 6 } as Token,
          stop: { tokenIndex: 6 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: jest.fn().mockImplementation(index => {
            return index === 0 ? operatorNode : innerExpression
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: '++i',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('i')
      })
    })
  })

  describe('Given a PreOpExpression with pre-decrement (--i)', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation removing the decrement', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        const operatorNode = new TerminalNode({ text: '--' } as Token)

        const innerExpression = {
          text: 'j',
          start: { tokenIndex: 6 } as Token,
          stop: { tokenIndex: 6 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: jest.fn().mockImplementation(index => {
            return index === 0 ? operatorNode : innerExpression
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: '--j',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('j')
      })
    })
  })

  describe('Given a PreOpExpression with unary minus (-x)', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const operatorNode = new TerminalNode({ text: '-' } as Token)

        const innerExpression = {
          text: 'x',
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: jest.fn().mockImplementation(index => {
            return index === 0 ? operatorNode : innerExpression
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PreOpExpression with unary plus (+x)', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const operatorNode = new TerminalNode({ text: '+' } as Token)

        const innerExpression = {
          text: 'x',
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: jest.fn().mockImplementation(index => {
            return index === 0 ? operatorNode : innerExpression
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an expression with wrong number of children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 3,
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PostOpExpression where operator is not a TerminalNode', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 2,
          getChild: jest.fn().mockImplementation(index => {
            return index === 0 ? { text: 'i' } : { text: '++' } // Not a TerminalNode
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PreOpExpression where operator is not a TerminalNode', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 2,
          getChild: jest.fn().mockImplementation(index => {
            return index === 0 ? { text: '++' } : { text: 'i' } // Not a TerminalNode
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PostOpExpression with non-increment TerminalNode operator', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const operatorNode = new TerminalNode({ text: '+' } as Token)

        const ctx = {
          childCount: 2,
          getChild: jest.fn().mockImplementation(index => {
            return index === 0 ? { text: 'i' } : operatorNode
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PreOpExpression with wrong childCount', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 3,
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })
})
