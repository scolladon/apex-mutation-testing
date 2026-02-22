import { Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { LiteralContext } from 'apex-parser'
import { InlineConstantMutator } from '../../../src/mutator/inlineConstantMutator.js'

function createLiteralCtx(
  literalType: string,
  node: TerminalNode
): LiteralContext {
  const ctx = Object.create(LiteralContext.prototype)
  Object.defineProperty(ctx, 'start', {
    value: node.symbol,
    writable: true,
  })
  Object.defineProperty(ctx, 'stop', {
    value: node.symbol,
    writable: true,
  })
  ctx.BooleanLiteral = () => (literalType === 'boolean' ? node : undefined)
  ctx.IntegerLiteral = () => (literalType === 'integer' ? node : undefined)
  ctx.LongLiteral = () => undefined
  ctx.NumberLiteral = () => undefined
  ctx.StringLiteral = () => undefined
  ctx.NULL = () => undefined
  return ctx
}

function createTerminalNode(text: string): TerminalNode {
  return new TerminalNode({
    text,
    tokenIndex: 5,
    line: 1,
    charPositionInLine: 10,
  } as Token)
}

describe('InlineConstantMutator', () => {
  let sut: InlineConstantMutator

  beforeEach(() => {
    sut = new InlineConstantMutator()
  })

  describe('Given a boolean literal true', () => {
    describe('When entering the literal', () => {
      it('Then should create mutation replacing true with false', () => {
        // Arrange
        const booleanNode = createTerminalNode('true')
        const ctx = createLiteralCtx('boolean', booleanNode)

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
        const booleanNode = createTerminalNode('false')
        const ctx = createLiteralCtx('boolean', booleanNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('true')
      })
    })
  })

  describe('Given an integer literal 42', () => {
    describe('When entering the literal', () => {
      it('Then should create 5 mutations: 0, 1, -1, 43, 41', () => {
        // Arrange
        const intNode = createTerminalNode('42')
        const ctx = createLiteralCtx('integer', intNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(5)
        const replacements = sut._mutations.map(m => m.replacement)
        expect(replacements).toEqual(['0', '1', '-1', '43', '41'])
      })
    })
  })

  describe('Given an integer literal 0', () => {
    describe('When entering the literal', () => {
      it('Then should not include 0 in replacements', () => {
        // Arrange
        const intNode = createTerminalNode('0')
        const ctx = createLiteralCtx('integer', intNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        const replacements = sut._mutations.map(m => m.replacement)
        expect(replacements).not.toContain('0')
        expect(replacements).toContain('1')
        expect(replacements).toContain('-1')
      })
    })
  })

  describe('Given an integer literal 1', () => {
    describe('When entering the literal', () => {
      it('Then should not include 1 in replacements', () => {
        // Arrange
        const intNode = createTerminalNode('1')
        const ctx = createLiteralCtx('integer', intNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        const replacements = sut._mutations.map(m => m.replacement)
        expect(replacements).not.toContain('1')
        expect(replacements).toContain('0')
        expect(replacements).toContain('-1')
        expect(replacements).toContain('2')
      })
    })
  })
})
