import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ReturnStatementContext } from 'apex-parser'
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
          getChild: vi.fn().mockImplementation(index => {
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
          getChild: vi.fn().mockImplementation(index => {
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
          getChild: vi.fn().mockImplementation(index => {
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
          getChild: vi.fn().mockImplementation(index => {
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
          getChild: vi.fn().mockImplementation(index => {
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

  describe('Given a PostOpExpression where operator is a plain object (not TerminalNode) with valid token range', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (kills instanceof TerminalNode → true mutant)', () => {
        // Arrange
        // With `instanceof TerminalNode → true`: the plain object passes the instance check,
        // has('++') = true, !true = false (doesn't return), creates mutation (ctx has start/stop).
        // Test expects 0 → kills the mutant.
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

        // Plain object with text '++', NOT a TerminalNode instance
        const nonTerminalOperator = { text: '++' }

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? innerExpression : nonTerminalOperator
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'i++',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert — operator is not a TerminalNode instance → no mutation
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
          getChild: vi.fn().mockImplementation(index => {
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

  describe('Given a PreOpExpression where operator is a plain object (not TerminalNode) with valid token range', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (kills instanceof TerminalNode → true mutant)', () => {
        // Arrange
        // Same as PostOp equivalent: with `instanceof TerminalNode → true` mutant,
        // the plain '++' object would pass, has('++') = true, !true = false,
        // would proceed to create a mutation with start/stop tokens present.
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 10,
        } as Token

        // Plain object with text '++', NOT a TerminalNode instance
        const nonTerminalOperator = { text: '++' }

        const innerExpression = {
          text: 'i',
          start: { tokenIndex: 6 } as Token,
          stop: { tokenIndex: 6 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? nonTerminalOperator : innerExpression
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: '++i',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert — operator is not a TerminalNode instance → no mutation
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
          getChild: vi.fn().mockImplementation(index => {
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

  describe('Given a PostOpExpression with non-increment TerminalNode operator and valid token range', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (kills !INCREMENT_OPERATORS.has() → false mutant)', () => {
        // Arrange
        // Without start/stop tokens, creating a mutation silently fails (createMutationFromParserRuleContext
        // checks ctx.start && ctx.stop). Adding valid tokens ensures the has() guard is the only
        // thing preventing mutation creation — so the `has() → false` mutant would create a mutation.
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

        const operatorNode = new TerminalNode({ text: '+' } as Token)

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? innerExpression : operatorNode
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'i+',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert — '+' is not in INCREMENT_OPERATORS, must not create mutation
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

  describe('Given a PostOpExpression (i++) directly inside a ReturnStatement', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations as return i++ is always equivalent to return i', () => {
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

        const returnCtx = Object.create(ReturnStatementContext.prototype)

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? innerExpression : operatorNode
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'i++',
          parent: returnCtx,
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PostOpExpression (i--) nested inside a ReturnStatement', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations as return i-- is always equivalent to return i', () => {
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

        const operatorNode = new TerminalNode({ text: '--' } as Token)

        const returnCtx = Object.create(ReturnStatementContext.prototype)
        const expressionCtx = {
          parent: returnCtx,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? innerExpression : operatorNode
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'i--',
          parent: expressionCtx,
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PostOpExpression (i++) deeply nested inside a ReturnStatement', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (equivalent: return (i++) == return i)', () => {
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

        const returnCtx = Object.create(ReturnStatementContext.prototype)
        // Two levels deep: ctx -> wrapperCtx -> returnCtx
        const wrapperCtx = {
          parent: returnCtx,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? innerExpression : operatorNode
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'i++',
          parent: wrapperCtx,
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PostOpExpression (i++) outside any ReturnStatement', () => {
    describe('When entering the expression', () => {
      it('Then should create a mutation (not inside return)', () => {
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

        // Parent chain ends without a ReturnStatementContext
        const blockCtx = {
          parent: null,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? innerExpression : operatorNode
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'i++',
          parent: blockCtx,
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('i')
      })
    })
  })

  describe('Given a PostOpExpression with childCount=3 but valid TerminalNode increment operator', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (childCount guard rejects non-binary expressions)', () => {
        // Arrange — kills ConditionalExpression false → if (false) mutant on childCount check
        // With 'false': skips childCount guard, gets to TerminalNode check, passes (is TerminalNode),
        // passes has('++') check, creates mutation — but test expects 0
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
        const extraChild = { text: 'extra' } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3, // not 2 — should be rejected by childCount guard
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return innerExpression
            if (index === 1) return operatorNode
            return extraChild
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'i++extra',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert — childCount !== 2 must cause early return
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PostOpExpression with childCount=3 but valid TerminalNode decrement operator', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (childCount guard rejects non-binary expressions)', () => {
        // Arrange — kills ConditionalExpression false on childCount check for -- operator
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
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return innerExpression
            if (index === 1) return operatorNode
            return { text: 'extra' } as unknown as ParserRuleContext
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'j--extra',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PreOpExpression with childCount=3 but valid TerminalNode increment operator', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (childCount guard rejects non-binary expressions)', () => {
        // Arrange — kills ConditionalExpression false on childCount check for pre-op
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
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return operatorNode
            if (index === 1) return innerExpression
            return { text: 'extra' } as unknown as ParserRuleContext
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: '++iextra',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert — childCount !== 2 must cause early return
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PreOpExpression with childCount=3 but valid TerminalNode decrement operator', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (childCount guard rejects non-binary expressions)', () => {
        // Arrange — kills ConditionalExpression false on childCount check for pre-op with --
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
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return operatorNode
            if (index === 1) return innerExpression
            return { text: 'extra' } as unknown as ParserRuleContext
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: '--jextra',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PreOpExpression with non-increment operator that IS a TerminalNode', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (INCREMENT_OPERATORS check rejects it)', () => {
        // Arrange — kills ConditionalExpression false on !INCREMENT_OPERATORS.has() for pre-op
        // TerminalNode with text '-' — not in the increment set
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

        // Assert — '-' is not in INCREMENT_OPERATORS, must not create mutation
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PostOpExpression with childCount=1 but increment TerminalNode at index 1', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (childCount !== 2 guard rejects childCount=1)', () => {
        // Arrange — kills childCount > 2 / childCount >= 2 / childCount < 1 mutants on the !== 2 guard.
        // With childCount=1 but getChild(1) returning a TerminalNode '++':
        // mutants that weaken the guard would proceed past the childCount check, pass the
        // TerminalNode instanceof check, pass the has('++') check, and create a mutation.
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
          childCount: 1, // only one child — guard must fire
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? innerExpression : operatorNode
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'i++',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert — childCount === 1, not 2, so guard must prevent mutation
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PostOpExpression with childCount=1 but decrement TerminalNode at index 1', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (childCount !== 2 guard rejects childCount=1)', () => {
        // Arrange — same as above but for '--' operator
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
          childCount: 1,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? innerExpression : operatorNode
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'j--',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PreOpExpression with childCount=1 but increment TerminalNode at index 0', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (childCount !== 2 guard rejects childCount=1)', () => {
        // Arrange — kills childCount > 2 / childCount >= 2 / childCount < 1 mutants for pre-op.
        // With childCount=1, getChild(0) returning a TerminalNode '++' and getChild(1) returning
        // a valid inner expression: mutants weakening the guard would create a mutation.
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
          childCount: 1,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? operatorNode : innerExpression
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: '++i',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PreOpExpression with childCount=1 but decrement TerminalNode at index 0', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (childCount !== 2 guard rejects childCount=1)', () => {
        // Arrange — same as above but for '--' operator
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
          childCount: 1,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? operatorNode : innerExpression
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: '--j',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPreOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a PostOpExpression with childCount=4 and increment operator at index 1', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (childCount !== 2 guard rejects childCount=4)', () => {
        // Arrange — kills childCount < 2 / childCount <= 2 mutants: those pass childCount=3 tests
        // but fail on childCount=4 because 4 <= 2 is false (meaning they allow it through)
        // vs childCount=4 with original: 4 !== 2 = true, returns early.
        // Actually this expands coverage for childCount far above 2.
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
          childCount: 4,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return innerExpression
            if (index === 1) return operatorNode
            return { text: 'extra' } as unknown as ParserRuleContext
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'i++extra',
        } as unknown as ParserRuleContext

        // Act
        sut.enterPostOpExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })
})
