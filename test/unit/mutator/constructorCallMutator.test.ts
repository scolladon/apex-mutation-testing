import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
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
          getChild: jest.fn().mockImplementation(index => {
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
          getChild: jest.fn().mockImplementation(index => {
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
          getChild: jest.fn().mockImplementation(index => {
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
          getChild: jest.fn().mockImplementation(() => {
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
})
