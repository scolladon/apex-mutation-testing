import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
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
          constructor: { name: 'MethodCallExpressionContext' },
        } as unknown as ParserRuleContext

        const semicolonNode = new TerminalNode({ text: ';' } as Token)

        const ctx = {
          childCount: 2,
          getChild: jest.fn().mockImplementation(index => {
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
          constructor: { name: 'DotExpressionContext' },
        } as unknown as ParserRuleContext

        const semicolonNode = new TerminalNode({ text: ';' } as Token)

        const ctx = {
          childCount: 2,
          getChild: jest.fn().mockImplementation(index => {
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
          constructor: { name: 'AssignExpressionContext' },
        } as unknown as ParserRuleContext

        const semicolonNode = new TerminalNode({ text: ';' } as Token)

        const ctx = {
          childCount: 2,
          getChild: jest.fn().mockImplementation(index => {
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
          constructor: { name: 'PostOpExpressionContext' },
        } as unknown as ParserRuleContext

        const semicolonNode = new TerminalNode({ text: ';' } as Token)

        const ctx = {
          childCount: 2,
          getChild: jest.fn().mockImplementation(index => {
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
})
