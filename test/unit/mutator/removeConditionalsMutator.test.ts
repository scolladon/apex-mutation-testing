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
          getChild: jest.fn().mockImplementation(index => {
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
          getChild: jest.fn().mockImplementation(index => {
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
          getChild: jest.fn().mockImplementation(() => {
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
})
