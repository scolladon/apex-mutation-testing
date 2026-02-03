import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { InvertNegativesMutator } from '../../../src/mutator/invertNegativesMutator.js'

describe('InvertNegativesMutator', () => {
  let sut: InvertNegativesMutator

  beforeEach(() => {
    sut = new InvertNegativesMutator()
  })

  describe('Given a PreOpExpression with unary minus on variable', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation to remove the negation', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        const operatorNode = new TerminalNode({ text: '-' } as Token)

        const innerExpression = {
          text: 'x',
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
          text: '-x',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('x')
        expect(sut._mutations[0].mutationName).toBe('InvertNegativesMutator')
      })
    })
  })

  describe('Given a PreOpExpression with unary minus on number', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation to remove the negation', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        const operatorNode = new TerminalNode({ text: '-' } as Token)

        const innerExpression = {
          text: '5',
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
          text: '-5',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('5')
        expect(sut._mutations[0].mutationName).toBe('InvertNegativesMutator')
      })
    })
  })

  describe('Given a PreOpExpression with increment operator (++)', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const operatorNode = new TerminalNode({ text: '++' } as Token)

        const innerExpression = {
          text: 'i',
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

  describe('Given a PreOpExpression with decrement operator (--)', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const operatorNode = new TerminalNode({ text: '--' } as Token)

        const innerExpression = {
          text: 'i',
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
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an expression where first child is not a TerminalNode', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 2,
          getChild: () => ({}), // Not a TerminalNode
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })
})
