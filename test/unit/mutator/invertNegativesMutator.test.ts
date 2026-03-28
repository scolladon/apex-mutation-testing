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
          getChild: vi.fn().mockImplementation(index => {
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
          getChild: vi.fn().mockImplementation(index => {
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
          getChild: vi.fn().mockImplementation(index => {
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
          getChild: vi.fn().mockImplementation(index => {
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

  describe('Given a PreOpExpression with 3 children but first is a minus TerminalNode', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations because childCount is not exactly 2', () => {
        // Arrange
        // Kills: `ctx.childCount !== 2` → `false`
        // With mutant `false`, the guard is skipped and code proceeds past it.
        // Since the first child IS a TerminalNode('-'), the text check also passes,
        // which would cause a mutation to be created — contradicting the expected behaviour.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 5,
        } as Token

        const operatorNode = new TerminalNode({ text: '-' } as Token)

        const innerExpression = {
          text: 'x',
          start: { tokenIndex: 2 } as Token,
          stop: { tokenIndex: 2 } as Token,
        } as unknown as ParserRuleContext

        const extraChild = { text: 'extra' } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return operatorNode
            if (index === 1) return innerExpression
            return extraChild
          }),
          start: mockToken,
          stop: { tokenIndex: 3 } as Token,
          text: '-x extra',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PreOpExpression with increment operator (++) and valid start/stop tokens', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        // Kills: `operatorNode.text !== '-'` → `false`
        // With mutant `false`, the guard is skipped so any operator proceeds.
        // With valid start/stop tokens, `createMutationFromParserRuleContext` would
        // actually create a mutation — contradicting the expected behaviour.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 5,
        } as Token

        const operatorNode = new TerminalNode({ text: '++' } as Token)

        const innerExpression = {
          text: 'i',
          start: { tokenIndex: 2 } as Token,
          stop: { tokenIndex: 2 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? operatorNode : innerExpression
          }),
          start: mockToken,
          stop: { tokenIndex: 2 } as Token,
          text: '++i',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PreOpExpression with decrement operator (--) and valid start/stop tokens', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        // Kills: `operatorNode.text !== '-'` → `false` and StringLiteral `'-'` → `""`
        // With either mutant the guard is bypassed; with valid tokens a mutation would be
        // created — contradicting the expected behaviour.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 5,
        } as Token

        const operatorNode = new TerminalNode({ text: '--' } as Token)

        const innerExpression = {
          text: 'i',
          start: { tokenIndex: 2 } as Token,
          stop: { tokenIndex: 2 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? operatorNode : innerExpression
          }),
          start: mockToken,
          stop: { tokenIndex: 2 } as Token,
          text: '--i',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })
})
