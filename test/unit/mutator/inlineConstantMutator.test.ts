import { Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { LiteralContext } from 'apex-parser'
import { InlineConstantMutator } from '../../../src/mutator/inlineConstantMutator.js'

describe('InlineConstantMutator', () => {
  let sut: InlineConstantMutator

  beforeEach(() => {
    sut = new InlineConstantMutator()
  })

  describe('Given a boolean literal true', () => {
    describe('When entering the literal', () => {
      it('Then should create mutation replacing true with false', () => {
        // Arrange
        const booleanNode = new TerminalNode({
          text: 'true',
          tokenIndex: 5,
          line: 1,
          charPositionInLine: 10,
        } as Token)
        const ctx = Object.create(LiteralContext.prototype)
        Object.defineProperty(ctx, 'start', {
          value: booleanNode.symbol,
          writable: true,
        })
        Object.defineProperty(ctx, 'stop', {
          value: booleanNode.symbol,
          writable: true,
        })
        ctx.BooleanLiteral = () => booleanNode
        ctx.IntegerLiteral = () => undefined
        ctx.LongLiteral = () => undefined
        ctx.NumberLiteral = () => undefined
        ctx.StringLiteral = () => undefined
        ctx.NULL = () => undefined

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('false')
        expect(sut._mutations[0].mutationName).toBe('InlineConstantMutator')
      })
    })
  })

  describe('Given a boolean literal false', () => {
    describe('When entering the literal', () => {
      it('Then should create mutation replacing false with true', () => {
        // Arrange
        const booleanNode = new TerminalNode({
          text: 'false',
          tokenIndex: 5,
          line: 1,
          charPositionInLine: 10,
        } as Token)
        const ctx = Object.create(LiteralContext.prototype)
        Object.defineProperty(ctx, 'start', {
          value: booleanNode.symbol,
          writable: true,
        })
        Object.defineProperty(ctx, 'stop', {
          value: booleanNode.symbol,
          writable: true,
        })
        ctx.BooleanLiteral = () => booleanNode
        ctx.IntegerLiteral = () => undefined
        ctx.LongLiteral = () => undefined
        ctx.NumberLiteral = () => undefined
        ctx.StringLiteral = () => undefined
        ctx.NULL = () => undefined

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('true')
      })
    })
  })
})
