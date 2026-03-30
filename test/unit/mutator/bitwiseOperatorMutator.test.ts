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
      getChild: vi.fn().mockImplementation(index => {
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
      it('Then enterBitAndExpression should not create any mutations', () => {
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

      it('Then enterBitOrExpression should not create any mutations (kills childCount !== 3 → === 3 mutant)', () => {
        // Arrange — kills EqualityOperator mutant on childCount guard in enterBitOrExpression path
        const ctx = {
          childCount: 2,
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterBitOrExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then enterBitNotExpression should not create any mutations (kills childCount !== 3 → === 3 mutant)', () => {
        // Arrange — kills EqualityOperator mutant on childCount guard in enterBitNotExpression path
        const ctx = {
          childCount: 2,
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterBitNotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an expression with exactly 3 children', () => {
    describe('When entering each bitwise expression type', () => {
      it('Then enterBitOrExpression with childCount 3 and TerminalNode should produce a mutation', () => {
        // Arrange — confirms the childCount === 3 path is the valid path for enterBitOrExpression
        mockTerminalNode = new TerminalNode({ text: '|' } as Token)

        // Act
        sut.enterBitOrExpression(mockCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('&')
      })

      it('Then enterBitNotExpression with childCount 3 and TerminalNode should produce a mutation', () => {
        // Arrange — confirms the childCount === 3 path is the valid path for enterBitNotExpression
        mockTerminalNode = new TerminalNode({ text: '^' } as Token)

        // Act
        sut.enterBitNotExpression(mockCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('&')
      })
    })
  })

  describe('Given an expression where child is not a TerminalNode', () => {
    describe('When entering the expression', () => {
      it('Then enterBitAndExpression should not create any mutations', () => {
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

      it('Then enterBitOrExpression should not create any mutations (kills instanceof check mutant)', () => {
        // Arrange — kills !(operatorNode instanceof TerminalNode) → false mutant
        const ctx = {
          childCount: 3,
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterBitOrExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then enterBitNotExpression should not create any mutations (kills instanceof check mutant)', () => {
        // Arrange — kills !(operatorNode instanceof TerminalNode) → false mutant
        const ctx = {
          childCount: 3,
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterBitNotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an expression with unknown operator', () => {
    describe('When entering the expression', () => {
      it('Then enterBitAndExpression should not create any mutations', () => {
        // Arrange
        mockTerminalNode = new TerminalNode({ text: '~' } as Token)

        // Act
        sut.enterBitAndExpression(mockCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then enterBitOrExpression should not create any mutations (kills if(replacement) → if(true) mutant)', () => {
        // Arrange — kills if (replacement) → if (true): an unknown operator has no mapping,
        // so replacement is undefined; mutation must NOT be created
        mockTerminalNode = new TerminalNode({ text: '~' } as Token)

        // Act
        sut.enterBitOrExpression(mockCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then enterBitNotExpression should not create any mutations (kills if(replacement) → if(true) mutant)', () => {
        // Arrange — kills if (replacement) → if (true): an unknown operator has no mapping,
        // so replacement is undefined; mutation must NOT be created
        mockTerminalNode = new TerminalNode({ text: '~' } as Token)

        // Act
        sut.enterBitNotExpression(mockCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an expression with childCount === 2 but a valid TerminalNode operator', () => {
    describe('When entering the expression', () => {
      it('Then enterBitAndExpression should not create any mutations (kills childCount !== 3 → > 3 mutant)', () => {
        // Arrange — childCount:2 with a TerminalNode operator that IS in the replacement map.
        // With mutant `childCount > 3`: 2 > 3 = false → guard does NOT fire → proceeds.
        // The subsequent instanceof check passes (it's a TerminalNode), replacement is found,
        // and a mutation would be created — distinguishing the original guard from the mutant.
        const operatorNode = new TerminalNode({ text: '&' } as Token)
        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 1 ? operatorNode : {}
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterBitAndExpression(ctx)

        // Assert — original guard fires (2 !== 3 → true → return early) → 0 mutations
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then enterBitOrExpression should not create any mutations (kills childCount !== 3 → > 3 mutant)', () => {
        // Arrange
        const operatorNode = new TerminalNode({ text: '|' } as Token)
        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 1 ? operatorNode : {}
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterBitOrExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then enterBitNotExpression should not create any mutations (kills childCount !== 3 → > 3 mutant)', () => {
        // Arrange
        const operatorNode = new TerminalNode({ text: '^' } as Token)
        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 1 ? operatorNode : {}
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterBitNotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })
})
