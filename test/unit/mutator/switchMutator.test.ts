import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { SwitchMutator } from '../../../src/mutator/switchMutator.js'

describe('SwitchMutator', () => {
  let sut: SwitchMutator

  beforeEach(() => {
    sut = new SwitchMutator()
  })

  describe('Given a WhenControl with a block', () => {
    describe('When entering the when control', () => {
      it('Then should create mutation to remove the block body', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 30,
        } as Token

        const whenKeyword = new TerminalNode({ text: 'when' } as Token)

        const whenValueCtx = {
          text: '1',
        } as unknown as ParserRuleContext

        const blockCtx = {
          text: '{ handle1(); }',
          start: { tokenIndex: 7 } as Token,
          stop: { tokenIndex: 10 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return whenKeyword
            if (index === 1) return whenValueCtx
            return blockCtx
          }),
          start: mockToken,
          stop: { tokenIndex: 10 } as Token,
          text: 'when 1 { handle1(); }',
        } as unknown as ParserRuleContext

        // Act
        sut.enterWhenControl(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('{}')
        expect(sut._mutations[0].mutationName).toBe('SwitchMutator')
      })
    })
  })

  describe('Given a WhenControl for else case', () => {
    describe('When entering the when control', () => {
      it('Then should create mutation to remove the else block body', () => {
        // Arrange
        const mockToken = {
          line: 1,
          charPositionInLine: 10,
          tokenIndex: 5,
          startIndex: 10,
          stopIndex: 35,
        } as Token

        const whenKeyword = new TerminalNode({ text: 'when' } as Token)

        const whenValueCtx = {
          text: 'else',
        } as unknown as ParserRuleContext

        const blockCtx = {
          text: '{ handleDefault(); }',
          start: { tokenIndex: 7 } as Token,
          stop: { tokenIndex: 12 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return whenKeyword
            if (index === 1) return whenValueCtx
            return blockCtx
          }),
          start: mockToken,
          stop: { tokenIndex: 12 } as Token,
          text: 'when else { handleDefault(); }',
        } as unknown as ParserRuleContext

        // Act
        sut.enterWhenControl(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('{}')
      })
    })
  })

  describe('Given a WhenControl with wrong number of children', () => {
    describe('When entering the when control', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 2, // Not enough children
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterWhenControl(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a WhenControl where first child is not when keyword', () => {
    describe('When entering the when control', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(() => {
            return { text: 'something' } // Not a TerminalNode
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterWhenControl(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a WhenControl where first child is TerminalNode but not when keyword', () => {
    describe('When entering the when control', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const notWhenKeyword = new TerminalNode({ text: 'case' } as Token)

        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return notWhenKeyword
            return { text: 'something' }
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterWhenControl(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a WhenControl with 4 children where first is a when TerminalNode', () => {
    describe('When entering the when control', () => {
      it('Then should not create any mutations because childCount is not exactly 3', () => {
        // Arrange
        // Kills: `ctx.childCount !== 3` → `false`
        // With mutant `false`, the guard is skipped and code proceeds; since the first child
        // IS a TerminalNode('when'), both subsequent checks pass and a mutation is created —
        // contradicting the expected behaviour.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 35,
        } as Token

        const whenKeyword = new TerminalNode({ text: 'when' } as Token)

        const whenValueCtx = {
          text: '1',
        } as unknown as ParserRuleContext

        const blockCtx = {
          text: '{ handle(); }',
          start: { tokenIndex: 7 } as Token,
          stop: { tokenIndex: 10 } as Token,
        } as unknown as ParserRuleContext

        const extraChild = { text: 'extra' } as unknown as ParserRuleContext

        const ctx = {
          childCount: 4,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return whenKeyword
            if (index === 1) return whenValueCtx
            if (index === 2) return blockCtx
            return extraChild
          }),
          start: mockToken,
          stop: { tokenIndex: 11 } as Token,
          text: 'when 1 { handle(); } extra',
        } as unknown as ParserRuleContext

        // Act
        sut.enterWhenControl(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a WhenControl with uppercase WHEN keyword', () => {
    describe('When entering the when control', () => {
      it('Then should create mutation to remove the block body', () => {
        // Arrange
        // Kills: `toLowerCase()` removal mutation — without toLowerCase(), 'WHEN' !== 'when'
        // would cause the guard to return early even though it is a valid when keyword.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 30,
        } as Token

        const whenKeyword = new TerminalNode({ text: 'WHEN' } as Token)

        const whenValueCtx = {
          text: '1',
        } as unknown as ParserRuleContext

        const blockCtx = {
          text: '{ handle(); }',
          start: { tokenIndex: 7 } as Token,
          stop: { tokenIndex: 10 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return whenKeyword
            if (index === 1) return whenValueCtx
            return blockCtx
          }),
          start: mockToken,
          stop: { tokenIndex: 10 } as Token,
          text: 'WHEN 1 { handle(); }',
        } as unknown as ParserRuleContext

        // Act
        sut.enterWhenControl(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('{}')
        expect(sut._mutations[0].mutationName).toBe('SwitchMutator')
      })
    })
  })

  describe('Given a WhenControl where first child is a non-when TerminalNode with valid tokens', () => {
    describe('When entering the when control', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        // Kills: `whenKeyword.text.toLowerCase() !== 'when'` → `false`
        // With mutant `false`, the guard is skipped and a mutation is created even for
        // non-when keywords with valid start/stop tokens — contradicting expected behaviour.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 30,
        } as Token

        const notWhenKeyword = new TerminalNode({ text: 'case' } as Token)

        const whenValueCtx = {
          text: '1',
        } as unknown as ParserRuleContext

        const blockCtx = {
          text: '{ handle(); }',
          start: { tokenIndex: 7 } as Token,
          stop: { tokenIndex: 10 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return notWhenKeyword
            if (index === 1) return whenValueCtx
            return blockCtx
          }),
          start: mockToken,
          stop: { tokenIndex: 10 } as Token,
          text: 'case 1 { handle(); }',
        } as unknown as ParserRuleContext

        // Act
        sut.enterWhenControl(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a WhenControl where first child is not a TerminalNode but has text "when" and valid tokens', () => {
    describe('When entering the when control', () => {
      it('Then should not create any mutations (kills !(whenKeyword instanceof TerminalNode) → false mutant)', () => {
        // Arrange
        // With mutant `false`, the instanceof guard is bypassed. The non-TerminalNode
        // with text 'when' passes the toLowerCase() text check, so code proceeds to
        // createMutationFromParserRuleContext(blockCtx) — producing 1 mutation instead of 0.
        const mockToken = {
          line: 1,
          charPositionInLine: 0,
          tokenIndex: 1,
          startIndex: 0,
          stopIndex: 30,
        } as Token

        const nonTerminalWhenNode = { text: 'when' } // NOT a TerminalNode, but has text 'when'

        const whenValueCtx = {
          text: '1',
        } as unknown as ParserRuleContext

        const blockCtx = {
          text: '{ handle(); }',
          start: { tokenIndex: 7 } as Token,
          stop: { tokenIndex: 10 } as Token,
        } as unknown as ParserRuleContext

        const ctx = {
          childCount: 3,
          getChild: vi.fn().mockImplementation(index => {
            if (index === 0) return nonTerminalWhenNode
            if (index === 1) return whenValueCtx
            return blockCtx
          }),
          start: mockToken,
          stop: { tokenIndex: 10 } as Token,
          text: 'when 1 { handle(); }',
        } as unknown as ParserRuleContext

        // Act
        sut.enterWhenControl(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })
})
