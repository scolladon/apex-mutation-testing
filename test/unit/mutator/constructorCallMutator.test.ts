import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ThrowStatementContext } from 'apex-parser'
import { ConstructorCallMutator } from '../../../src/mutator/constructorCallMutator.js'

describe('ConstructorCallMutator', () => {
  let sut: ConstructorCallMutator

  beforeEach(() => {
    sut = new ConstructorCallMutator()
  })

  describe('Given a NewExpression with constructor call', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation replacing with null', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 25,
        } as Token

        const newKeyword = new TerminalNode({ text: 'new' } as Token)

        const creatorCtx = {
          text: 'Account()',
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? newKeyword : creatorCtx
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'new Account()',
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('null')
        expect(sut._mutations[0].mutationName).toBe('ConstructorCallMutator')
      })
    })
  })

  describe('Given a NewExpression with generic type', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation replacing with null', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 30,
        } as Token

        const newKeyword = new TerminalNode({ text: 'new' } as Token)

        const creatorCtx = {
          text: 'List<String>()',
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? newKeyword : creatorCtx
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'new List<String>()',
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('null')
      })
    })
  })

  describe('Given a NewExpression with constructor arguments', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation replacing with null', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 35,
        } as Token

        const newKeyword = new TerminalNode({ text: 'new' } as Token)

        const creatorCtx = {
          text: "Account(Name = 'Test')",
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? newKeyword : creatorCtx
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: "new Account(Name = 'Test')",
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('null')
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
        sut.enterNewExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an expression where first child is not new keyword', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(() => {
            return { text: 'something' } // Not a TerminalNode
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an expression where first child is TerminalNode but not new keyword', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const notNewKeyword = new TerminalNode({ text: 'delete' } as Token)

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? notNewKeyword : { text: 'Account()' }
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a NewExpression inside a throw statement', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        // ThrowStatementContext imported from apex-parser at top of file
        const throwCtx = Object.create(ThrowStatementContext.prototype)

        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 25,
        } as Token

        const newKeyword = new TerminalNode({ text: 'new' } as Token)

        const creatorCtx = {
          text: "AuraHandledException('Error')",
        } as unknown as ParserRuleContext

        const expressionCtx = {
          parent: throwCtx,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? newKeyword : creatorCtx
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: "new AuraHandledException('Error')",
          parent: expressionCtx,
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a NewExpression where first child is non-TerminalNode with text new', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (kills newKeyword instanceof TerminalNode → true mutant)', () => {
        // Arrange
        // With mutant `true`: non-TerminalNode check always passes, so a plain object with text='new'
        // would proceed to create a mutation. Original code rejects non-TerminalNode nodes.
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 25,
        } as Token

        const nonTerminalNewKeyword = { text: 'new' } // NOT a TerminalNode

        const creatorCtx = {
          text: 'Account()',
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? nonTerminalNewKeyword : creatorCtx
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'new Account()',
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a NewExpression directly inside a throw statement (no intermediate context)', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        // This test kills `current instanceof ThrowStatementContext → true` mutant:
        // with the mutant, the while loop body always returns true on the first iteration,
        // even for non-throw parents. This test has ctx.parent as a ThrowStatementContext
        // directly, so both original and mutant give the same result (no mutation).
        // Combined with the test below that has a non-throw parent, the mutant is distinguished.
        const throwCtx = Object.create(ThrowStatementContext.prototype)

        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 25,
        } as Token

        const newKeyword = new TerminalNode({ text: 'new' } as Token)

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0
              ? newKeyword
              : { text: "AuraHandledException('Error')" }
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: "new AuraHandledException('Error')",
          parent: throwCtx,
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a NewExpression where keyword is uppercase NEW', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation — toLowerCase makes NEW equivalent to new (kills toLowerCase removal mutant)', () => {
        // Arrange — newKeyword.text is 'NEW' (uppercase).
        // Without toLowerCase(), 'NEW' !== 'new' would be true → returns early, no mutation.
        // With toLowerCase(), 'NEW'.toLowerCase() === 'new' → proceeds to create mutation.
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 25,
        } as Token

        const newKeyword = new TerminalNode({ text: 'NEW' } as Token)

        const creatorCtx = {
          text: 'Account()',
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? newKeyword : creatorCtx
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'NEW Account()',
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert — toLowerCase makes 'NEW' match 'new', so a mutation is created
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('null')
      })
    })
  })

  describe('Given a NewExpression where keyword is mixed-case New', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation — toLowerCase makes New equivalent to new (kills toLowerCase removal mutant)', () => {
        // Arrange — newKeyword.text is 'New' (mixed case).
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 25,
        } as Token

        const newKeyword = new TerminalNode({ text: 'New' } as Token)

        const creatorCtx = {
          text: 'Account()',
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? newKeyword : creatorCtx
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'New Account()',
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('null')
      })
    })
  })

  describe('Given a NewExpression inside a throw statement nested two levels deep', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (kills while loop body BlockStatement mutant)', () => {
        // Arrange — ThrowStatementContext is 2 levels up from ctx.
        // This tests that the while loop traverses multiple levels.
        // With a BlockStatement mutant (body → {}), the loop never returns true → mutations
        // are created even inside deeply nested throw statements.
        const throwCtx = Object.create(ThrowStatementContext.prototype)

        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 25,
        } as Token

        const newKeyword = new TerminalNode({ text: 'new' } as Token)

        const intermediateCtx = {
          parent: throwCtx,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0
              ? newKeyword
              : { text: "AuraHandledException('Error')" }
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: "new AuraHandledException('Error')",
          parent: intermediateCtx,
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert — deeply nested throw is detected → no mutation created
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a NewExpression with childCount of 1 and valid new TerminalNode at index 0', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (kills childCount !== 2 → > 2 mutant)', () => {
        // Arrange — childCount === 1, child[0] is a valid 'new' TerminalNode.
        // With mutant `childCount > 2`: 1 > 2 = false → guard does NOT fire → proceeds.
        // child[0] is TerminalNode 'new', passes the instanceof and lowercase checks.
        // ctx has start/stop → createMutationFromParserRuleContext would produce a mutation.
        // Original `!== 2`: 1 !== 2 = true → returns early → 0 mutations.
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 25,
        } as Token

        const newKeyword = new TerminalNode({ text: 'new' } as Token)

        const ctx = {
          childCount: 1,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? newKeyword : undefined
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'new',
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert — childCount !== 2 guard fires → no mutation created
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a NewExpression with childCount of 0', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (kills childCount !== 2 → < 2 mutant)', () => {
        // Arrange — childCount === 0.
        // With mutant `childCount < 2`: 0 < 2 = true → returns early.
        // Original: 0 !== 2 = true → also returns early.
        // This test acts as a complement: childCount=0 must always produce 0 mutations.
        // Combined with the childCount=1 test above, it covers the > 2 mutant range.
        const ctx = {
          childCount: 0,
          getChild: vi.fn(),
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a NewExpression inside a non-throw parent context', () => {
    describe('When entering the expression', () => {
      it('Then should create a mutation (kills current instanceof ThrowStatementContext → true mutant)', () => {
        // Arrange
        // With mutant `current instanceof ThrowStatementContext → true`:
        // the while loop always returns true on the first iteration, so ANY parent
        // would be treated as a throw context, blocking all mutations.
        // This test has a non-throw parent → original code creates mutation,
        // mutant blocks it.
        const nonThrowParent = {
          parent: undefined,
        } as unknown as ParserRuleContext

        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 25,
        } as Token

        const newKeyword = new TerminalNode({ text: 'new' } as Token)

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            return index === 0 ? newKeyword : { text: 'Account()' }
          }),
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
          text: 'new Account()',
          parent: nonThrowParent,
        } as unknown as ParserRuleContext

        // Act
        sut.enterNewExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('null')
      })
    })
  })
})
