import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BitwiseOperatorMutator } from '../../../src/mutator/bitwiseOperatorMutator.js'

describe('BitwiseOperatorMutator', () => {
  let sut: BitwiseOperatorMutator
  let mockCtx: ParserRuleContext
  let mockTerminalNode: TerminalNode

  beforeEach(() => {
    sut = new BitwiseOperatorMutator()
    mockCtx = {
      childCount: 3,
      getChild: jest.fn().mockImplementation(index => {
        return index === 1 ? mockTerminalNode : {}
      }),
    } as unknown as ParserRuleContext
  })

  describe('Given a BitAndExpression (&)', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation to replace & with |', () => {
        // Arrange
        mockTerminalNode = new TerminalNode({ text: '&' } as Token)

        // Act
        sut.enterBitAndExpression(mockCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('|')
        expect(sut._mutations[0].mutationName).toBe('BitwiseOperatorMutator')
      })
    })
  })

  describe('Given a BitOrExpression (|)', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation to replace | with &', () => {
        // Arrange
        mockTerminalNode = new TerminalNode({ text: '|' } as Token)

        // Act
        sut.enterBitOrExpression(mockCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('&')
        expect(sut._mutations[0].mutationName).toBe('BitwiseOperatorMutator')
      })
    })
  })

  describe('Given a BitNotExpression (^)', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation to replace ^ with &', () => {
        // Arrange
        mockTerminalNode = new TerminalNode({ text: '^' } as Token)

        // Act
        sut.enterBitNotExpression(mockCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('&')
        expect(sut._mutations[0].mutationName).toBe('BitwiseOperatorMutator')
      })
    })
  })

  describe('Given an expression with insufficient children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 2,
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterBitAndExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an expression where child is not a TerminalNode', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 3,
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterBitAndExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an expression with unknown operator', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        mockTerminalNode = new TerminalNode({ text: '~' } as Token)

        // Act
        sut.enterBitAndExpression(mockCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })
})
