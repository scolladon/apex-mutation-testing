import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { RemoveConditionalsMutator } from '../../../src/mutator/removeConditionalsMutator.js'

describe('RemoveConditionalsMutator', () => {
  let sut: RemoveConditionalsMutator

  beforeEach(() => {
    sut = new RemoveConditionalsMutator()
  })

  describe('Given an IfStatement with a condition', () => {
    describe('When entering the statement', () => {
      it('Then should create mutations to replace condition with true and false', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 25,
        } as Token

        const ifKeyword = new TerminalNode({ text: 'if' } as Token)

        const conditionCtx = {
          text: '(x > 0)',
          start: mockToken,
          stop: { tokenIndex: 8 } as Token,
        } as unknown as ParserRuleContext

        const thenBlock = {
          text: '{ doA(); }',
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return ifKeyword
            if (index === 1) return conditionCtx
            return thenBlock
          }),
          start: mockToken,
          stop: { tokenIndex: 10 } as Token,
          text: 'if (x > 0) { doA(); }',
        } as unknown as ParserRuleContext

        // Act
        sut.enterIfStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(2)
        expect(sut._mutations[0].replacement).toBe('(true)')
        expect(sut._mutations[1].replacement).toBe('(false)')
        expect(sut._mutations[0].mutationName).toBe('RemoveConditionalsMutator')
      })
    })
  })

  describe('Given an IfStatement with else block', () => {
    describe('When entering the statement', () => {
      it('Then should create mutations for the condition', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 40,
        } as Token

        const ifKeyword = new TerminalNode({ text: 'if' } as Token)

        const conditionCtx = {
          text: '(condition)',
          start: mockToken,
          stop: { tokenIndex: 8 } as Token,
        } as unknown as ParserRuleContext

        const thenBlock = {
          text: '{ doA(); }',
        } as unknown as ParserRuleContext

        const elseKeyword = new TerminalNode({ text: 'else' } as Token)

        const elseBlock = {
          text: '{ doB(); }',
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 5,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return ifKeyword
            if (index === 1) return conditionCtx
            if (index === 2) return thenBlock
            if (index === 3) return elseKeyword
            return elseBlock
          }),
          start: mockToken,
          stop: { tokenIndex: 15 } as Token,
          text: 'if (condition) { doA(); } else { doB(); }',
        } as unknown as ParserRuleContext

        // Act
        sut.enterIfStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(2)
        expect(sut._mutations[0].replacement).toBe('(true)')
        expect(sut._mutations[1].replacement).toBe('(false)')
      })
    })
  })

  describe('Given an IfStatement with too few children', () => {
    describe('When entering the statement', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 2, // Not enough children
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterIfStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an IfStatement where first child is not if keyword', () => {
    describe('When entering the statement', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(() => {
            return { text: 'something' } // Not a TerminalNode
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterIfStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an IfStatement where first child is TerminalNode but not if keyword', () => {
    describe('When entering the statement', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const notIfKeyword = new TerminalNode({ text: 'while' } as Token)

        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return notIfKeyword
            return { text: 'something' }
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterIfStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an IfStatement whose condition is already (true)', () => {
    it('Then should create only 1 mutation: (false) — skipping (true) as no-op', () => {
      // Arrange
      const mockToken = {
        line: 1,
        charPositionInLine: 0,
        tokenIndex: 1,
        startIndex: 3,
        stopIndex: 8,
      } as Token

      const ifKeyword = new TerminalNode({ text: 'if' } as Token)
      const conditionCtx = {
        text: '(true)',
        start: mockToken,
        stop: { tokenIndex: 3 } as Token,
      } as unknown as ParserRuleContext
      const thenBlock = { text: '{ doA(); }' } as unknown as ParserRuleContext

      const ctx = {
        childCount: 3,
        getChild: vi.fn().mockImplementation(index => {
          if (index === 0) return ifKeyword
          if (index === 1) return conditionCtx
          return thenBlock
        }),
        start: mockToken,
        stop: { tokenIndex: 10 } as Token,
        text: 'if (true) { doA(); }',
      } as unknown as ParserRuleContext

      // Act
      sut.enterIfStatement(ctx)

      // Assert — replacing (true) → (true) is a no-op, skip it
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('(false)')
    })
  })

  describe('Given an IfStatement whose condition is already (false)', () => {
    it('Then should create only 1 mutation: (true) — skipping (false) as no-op', () => {
      // Arrange
      const mockToken = {
        line: 1,
        charPositionInLine: 0,
        tokenIndex: 1,
        startIndex: 3,
        stopIndex: 9,
      } as Token

      const ifKeyword = new TerminalNode({ text: 'if' } as Token)
      const conditionCtx = {
        text: '(false)',
        start: mockToken,
        stop: { tokenIndex: 3 } as Token,
      } as unknown as ParserRuleContext
      const thenBlock = { text: '{ doA(); }' } as unknown as ParserRuleContext

      const ctx = {
        childCount: 3,
        getChild: vi.fn().mockImplementation(index => {
          if (index === 0) return ifKeyword
          if (index === 1) return conditionCtx
          return thenBlock
        }),
        start: mockToken,
        stop: { tokenIndex: 10 } as Token,
        text: 'if (false) { doA(); }',
      } as unknown as ParserRuleContext

      // Act
      sut.enterIfStatement(ctx)

      // Assert — replacing (false) → (false) is a no-op, skip it
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('(true)')
    })
  })

  describe('Given an IfStatement with exactly 2 children and a valid if TerminalNode', () => {
    describe('When entering the statement', () => {
      it('Then should not create any mutations because childCount is below 3', () => {
        // Arrange
        // Kills: `ctx.childCount < 3` → `false`
        // With mutant `false`, the guard is skipped; since the first child IS a
        // TerminalNode('if'), and the condition node has valid tokens, mutations would be
        // created — contradicting the expected behaviour.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 15,
        } as Token

        const ifKeyword = new TerminalNode({ text: 'if' } as Token)
        const conditionCtx = {
          text: '(x > 0)',
          start: mockToken,
          stop: { tokenIndex: 5 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 2,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return ifKeyword
            return conditionCtx
          }),
          start: mockToken,
          stop: { tokenIndex: 5 } as Token,
          text: 'if (x > 0)',
        } as unknown as ParserRuleContext

        // Act
        sut.enterIfStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an IfStatement with 5 children where first is a valid if TerminalNode', () => {
    describe('When entering the statement', () => {
      it('Then should create mutations for the condition', () => {
        // Arrange
        // Kills: `ctx.childCount < 3` → `ctx.childCount > 3`
        // With mutant `> 3`, childCount=5 would trigger the guard and return early,
        // producing 0 mutations when 2 are expected.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 50,
        } as Token

        const ifKeyword = new TerminalNode({ text: 'if' } as Token)
        const conditionCtx = {
          text: '(a && b)',
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
        } as unknown as ParserRuleContext
        const thenBlock = {
          text: '{ doA(); }',
        } as unknown as ParserRuleContext
        const elseKeyword = new TerminalNode({ text: 'else' } as Token)
        const elseBlock = {
          text: '{ doB(); }',
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 5,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return ifKeyword
            if (index === 1) return conditionCtx
            if (index === 2) return thenBlock
            if (index === 3) return elseKeyword
            return elseBlock
          }),
          start: mockToken,
          stop: { tokenIndex: 18 } as Token,
          text: 'if (a && b) { doA(); } else { doB(); }',
        } as unknown as ParserRuleContext

        // Act
        sut.enterIfStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(2)
        expect(sut._mutations[0].replacement).toBe('(true)')
        expect(sut._mutations[1].replacement).toBe('(false)')
      })
    })
  })

  describe('Given an IfStatement with uppercase IF keyword', () => {
    describe('When entering the statement', () => {
      it('Then should create mutations for the condition', () => {
        // Arrange
        // Kills: `toLowerCase()` removal mutation on ifKeyword.text
        // Without toLowerCase(), 'IF' !== 'if' would cause the guard to return early
        // even though this is a valid if statement.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 20,
        } as Token

        const ifKeyword = new TerminalNode({ text: 'IF' } as Token)
        const conditionCtx = {
          text: '(x > 0)',
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
        } as unknown as ParserRuleContext
        const thenBlock = {
          text: '{ doA(); }',
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return ifKeyword
            if (index === 1) return conditionCtx
            return thenBlock
          }),
          start: mockToken,
          stop: { tokenIndex: 10 } as Token,
          text: 'IF (x > 0) { doA(); }',
        } as unknown as ParserRuleContext

        // Act
        sut.enterIfStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(2)
        expect(sut._mutations[0].replacement).toBe('(true)')
        expect(sut._mutations[1].replacement).toBe('(false)')
      })
    })
  })

  describe('Given an IfStatement where first child is a non-if TerminalNode with valid tokens', () => {
    describe('When entering the statement', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        // Kills: `ifKeyword.text.toLowerCase() !== 'if'` → `false`
        // With mutant `false`, the guard is skipped and mutations would be created for the
        // valid condition context even though the keyword is not 'if'.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 25,
        } as Token

        const notIfKeyword = new TerminalNode({ text: 'while' } as Token)
        const conditionCtx = {
          text: '(x > 0)',
          start: mockToken,
          stop: { tokenIndex: 6 } as Token,
        } as unknown as ParserRuleContext
        const thenBlock = {
          text: '{ doA(); }',
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return notIfKeyword
            if (index === 1) return conditionCtx
            return thenBlock
          }),
          start: mockToken,
          stop: { tokenIndex: 10 } as Token,
          text: 'while (x > 0) { doA(); }',
        } as unknown as ParserRuleContext

        // Act
        sut.enterIfStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })
})
