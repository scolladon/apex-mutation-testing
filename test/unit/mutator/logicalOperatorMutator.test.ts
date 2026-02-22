import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { LogicalOperatorMutator } from '../../../src/mutator/logicalOperatorMutator.js'

describe('LogicalOperatorMutator', () => {
  let sut: LogicalOperatorMutator
  let mockCtx: ParserRuleContext
  let mockTerminalNode: TerminalNode

  beforeEach(() => {
    sut = new LogicalOperatorMutator()
    mockCtx = {
      childCount: 3,
      getChild: jest.fn().mockImplementation(index => {
        return index === 1 ? mockTerminalNode : {}
      }),
    } as unknown as ParserRuleContext
  })

  describe('Given a LogAndExpression (&&)', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation to replace && with ||', () => {
        // Arrange
        mockTerminalNode = new TerminalNode({ text: '&&' } as Token)

        // Act
        sut.enterLogAndExpression(mockCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('||')
        expect(sut._mutations[0].mutationName).toBe('LogicalOperatorMutator')
      })
    })
  })

  describe('Given a LogOrExpression (||)', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation to replace || with &&', () => {
        // Arrange
        mockTerminalNode = new TerminalNode({ text: '||' } as Token)

        // Act
        sut.enterLogOrExpression(mockCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('&&')
        expect(sut._mutations[0].mutationName).toBe('LogicalOperatorMutator')
      })
    })
  })

  describe('Given an expression with insufficient children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 2, // Not enough children
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterLogAndExpression(ctx)

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
          getChild: () => ({}), // Not a TerminalNode
        } as unknown as ParserRuleContext

        // Act
        sut.enterLogAndExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an expression where operator has no replacement mapping', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        mockTerminalNode = new TerminalNode({ text: '^' } as Token)

        // Act
        sut.enterLogAndExpression(mockCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })
})
