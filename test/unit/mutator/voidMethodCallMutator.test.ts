import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { DotExpressionContext, MethodCallExpressionContext } from 'apex-parser'
import { VoidMethodCallMutator } from '../../../src/mutator/voidMethodCallMutator.js'

describe('VoidMethodCallMutator', () => {
  let sut: VoidMethodCallMutator

  beforeEach(() => {
    sut = new VoidMethodCallMutator()
  })

  describe('Given an ExpressionStatement with a method call', () => {
    describe('When entering the statement', () => {
      it('Then should create mutation to remove the method call', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 25,
        } as Token

        const methodCallExpression = {
          text: 'doSomething()',
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(
          methodCallExpression,
          MethodCallExpressionContext.prototype
        )

        const semicolonNode = new TerminalNode({ text: ';' } as Token)

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? methodCallExpression : semicolonNode
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'doSomething();',
        } as unknown as ParserRuleContext

        // Act
        sut.enterExpressionStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('')
        expect(sut._mutations[0].mutationName).toBe('VoidMethodCallMutator')
      })
    })
  })

  describe('Given an ExpressionStatement with a dot expression method call', () => {
    describe('When entering the statement', () => {
      it('Then should create mutation to remove the method call', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 30,
        } as Token

        const dotExpression = {
          text: "System.debug('test')",
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(dotExpression, DotExpressionContext.prototype)

        const semicolonNode = new TerminalNode({ text: ';' } as Token)

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? dotExpression : semicolonNode
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: "System.debug('test');",
        } as unknown as ParserRuleContext

        // Act
        sut.enterExpressionStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('')
      })
    })
  })

  describe('Given an ExpressionStatement with an assignment', () => {
    describe('When entering the statement', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const assignExpression = {
          text: 'x = 5',
        } as unknown as ParserRuleContext

        const semicolonNode = new TerminalNode({ text: ';' } as Token)

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? assignExpression : semicolonNode
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterExpressionStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an ExpressionStatement with increment expression', () => {
    describe('When entering the statement', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const postOpExpression = {
          text: 'i++',
        } as unknown as ParserRuleContext

        const semicolonNode = new TerminalNode({ text: ';' } as Token)

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? postOpExpression : semicolonNode
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterExpressionStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an ExpressionStatement with wrong number of children', () => {
    describe('When entering the statement', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 3,
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterExpressionStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an ExpressionStatement with 3 children where first is a method call', () => {
    describe('When entering the statement', () => {
      it('Then should not create any mutations because childCount is not exactly 2', () => {
        // Arrange
        // Kills: `ctx.childCount !== 2` → `false`
        // With mutant `false`, the guard is skipped; since the first child IS a
        // MethodCallExpressionContext with valid tokens, a mutation would be created —
        // contradicting the expected behaviour.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 30,
        } as Token

        const methodCallExpression = {
          text: 'doSomething()',
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(
          methodCallExpression,
          MethodCallExpressionContext.prototype
        )

        const semicolonNode = new TerminalNode({ text: ';' } as Token)
        const extraChild = { text: 'extra' } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return methodCallExpression
            if (index === 1) return semicolonNode
            return extraChild
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'doSomething(); extra',
        } as unknown as ParserRuleContext

        // Act
        sut.enterExpressionStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an ExpressionStatement with 3 children where first is a dot expression', () => {
    describe('When entering the statement', () => {
      it('Then should not create any mutations because childCount is not exactly 2', () => {
        // Arrange
        // Kills: `ctx.childCount !== 2` → `false`
        // With mutant `false`, the guard is skipped; since the first child IS a
        // DotExpressionContext with valid tokens, a mutation would be created —
        // contradicting the expected behaviour.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 35,
        } as Token

        const dotExpression = {
          text: "System.debug('test')",
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(dotExpression, DotExpressionContext.prototype)

        const semicolonNode = new TerminalNode({ text: ';' } as Token)
        const extraChild = { text: 'extra' } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return dotExpression
            if (index === 1) return semicolonNode
            return extraChild
          }),
          start: mockToken,
          stop: { tokenIndex: 7 } as Token,
          text: "System.debug('test'); extra",
        } as unknown as ParserRuleContext

        // Act
        sut.enterExpressionStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an ExpressionStatement with 2 children where first is neither MethodCallExpression nor DotExpression but has valid tokens', () => {
    describe('When entering the statement', () => {
      it('Then should not create any mutations (kills !(expression instanceof MethodCallExpressionContext) → false mutant)', () => {
        // Arrange
        // With mutant `false` on first instanceof: `false && !(expr instanceof DEC)` = false
        // → never returns early → createMutationFromParserRuleContext is called with valid tokens
        // → produces 1 mutation instead of 0.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 10,
        } as Token

        const plainExpression = {
          text: 'i++',
        } as unknown as ParserRuleContext
        // NOT a MethodCallExpressionContext or DotExpressionContext

        const semicolonNode = new TerminalNode({ text: ';' } as Token)

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? plainExpression : semicolonNode
          }),
          start: mockToken,
          stop: { tokenIndex: 3 } as Token,
          text: 'i++;',
        } as unknown as ParserRuleContext

        // Act
        sut.enterExpressionStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })
})
