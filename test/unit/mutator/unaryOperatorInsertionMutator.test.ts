import { ParserRuleContext } from 'antlr4ts'
import { UnaryOperatorInsertionMutator } from '../../../src/mutator/unaryOperatorInsertionMutator.js'
import { TestUtil } from '../../utils/testUtil.js'

const createPrimaryExpression = (
  text: string,
  options?: { withTokens?: boolean; childIsParserRule?: boolean }
) => {
  const { withTokens = true, childIsParserRule = true } = options ?? {}

  const primary = childIsParserRule
    ? (() => {
        const node = {
          text,
          childCount: 0,
          children: [],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(node, ParserRuleContext.prototype)
        return node
      })()
    : { text }

  return {
    childCount: 1,
    text,
    start: withTokens ? TestUtil.createToken(1, 0) : null,
    stop: withTokens ? TestUtil.createToken(1, text.length) : null,
    getChild: (index: number) => (index === 0 ? primary : null),
  } as unknown as ParserRuleContext
}

describe('UnaryOperatorInsertionMutator', () => {
  let sut: UnaryOperatorInsertionMutator

  beforeEach(() => {
    sut = new UnaryOperatorInsertionMutator()
  })

  describe('Given a primary expression with a variable identifier', () => {
    describe('When entering the expression', () => {
      it('Then should create 4 mutations (x++, ++x, x--, --x)', () => {
        // Arrange
        const ctx = createPrimaryExpression('counter')

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(4)
        expect(sut._mutations[0].replacement).toBe('counter++')
        expect(sut._mutations[1].replacement).toBe('++counter')
        expect(sut._mutations[2].replacement).toBe('counter--')
        expect(sut._mutations[3].replacement).toBe('--counter')
      })
    })
  })

  describe('Given a primary expression with a number literal', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = createPrimaryExpression('42')

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a primary expression with a string literal', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = createPrimaryExpression("'hello'")

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a primary expression with boolean/null literals', () => {
    describe('When entering the expression', () => {
      it.each([
        'true',
        'false',
        'null',
      ])('Then should not create mutations for %s', literal => {
        // Arrange
        const ctx = createPrimaryExpression(literal)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a primary expression with this/super', () => {
    describe('When entering the expression', () => {
      it.each([
        'this',
        'super',
      ])('Then should not create mutations for %s', keyword => {
        // Arrange
        const ctx = createPrimaryExpression(keyword)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a primary expression with multiple children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 2,
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a primary expression where child is not ParserRuleContext', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = createPrimaryExpression('x', {
          childIsParserRule: false,
        })

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a primary expression without start/stop tokens', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = createPrimaryExpression('x', { withTokens: false })

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given mutations metadata', () => {
    it('Then mutationName should be UnaryOperatorInsertionMutator', () => {
      // Arrange
      const ctx = createPrimaryExpression('x')

      // Act
      sut.enterPrimaryExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(4)
      sut._mutations.forEach(mutation => {
        expect(mutation.mutationName).toBe('UnaryOperatorInsertionMutator')
      })
    })
  })
})
