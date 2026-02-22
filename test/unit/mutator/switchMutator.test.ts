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
          getChild: jest.fn().mockImplementation(index => {
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
          getChild: jest.fn().mockImplementation(index => {
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
          getChild: jest.fn().mockImplementation(() => {
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
          getChild: jest.fn().mockImplementation(index => {
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
})
