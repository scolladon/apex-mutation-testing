import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { LogicalOperatorDeletionMutator } from '../../../src/mutator/logicalOperatorDeletionMutator.js'
import { TestUtil } from '../../utils/testUtil.js'

function createLogicalCtx(
  leftText: string,
  op: '&&' | '||',
  rightText: string
): ParserRuleContext {
  const operatorNode = new TerminalNode({ text: op } as Token)
  const leftNode = { text: leftText }
  const rightNode = { text: rightText }
  return {
    childCount: 3,
    text: `${leftText}${op}${rightText}`,
    start: TestUtil.createToken(1, 0),
    stop: TestUtil.createToken(
      1,
      leftText.length + op.length + rightText.length
    ),
    getChild: (index: number) => {
      if (index === 0) return leftNode
      if (index === 1) return operatorNode
      return rightNode
    },
  } as unknown as ParserRuleContext
}

describe('LogicalOperatorDeletionMutator', () => {
  let sut: LogicalOperatorDeletionMutator

  beforeEach(() => {
    sut = new LogicalOperatorDeletionMutator()
  })

  describe('Given a LogAndExpression with non-identity operands (x && y)', () => {
    it('Then should create 2 mutations: left operand and right operand', () => {
      // Arrange
      const ctx = createLogicalCtx('x', '&&', 'y')

      // Act
      sut.enterLogAndExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(2)
      expect(sut._mutations[0].replacement).toBe('x')
      expect(sut._mutations[1].replacement).toBe('y')
      expect(sut._mutations[0].mutationName).toBe(
        'LogicalOperatorDeletionMutator'
      )
    })
  })

  describe('Given a LogAndExpression where right operand is true (x && true)', () => {
    it('Then should create only 1 mutation: left operand (right is identity for &&)', () => {
      // Arrange
      const ctx = createLogicalCtx('x', '&&', 'true')

      // Act
      sut.enterLogAndExpression(ctx)

      // Assert — x && true = x, so "→ x" is equivalent, skipped
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('true')
    })
  })

  describe('Given a LogAndExpression where left operand is true (true && y)', () => {
    it('Then should create only 1 mutation: right operand (left is identity for &&)', () => {
      // Arrange
      const ctx = createLogicalCtx('true', '&&', 'y')

      // Act
      sut.enterLogAndExpression(ctx)

      // Assert — true && y = y, so "→ y" is equivalent, skipped
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('true')
    })
  })

  describe('Given a LogAndExpression where both operands are true (true && true)', () => {
    it('Then should create 0 mutations (both sides are identity)', () => {
      // Arrange
      const ctx = createLogicalCtx('true', '&&', 'true')

      // Act
      sut.enterLogAndExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a LogOrExpression with non-identity operands (x || y)', () => {
    it('Then should create 2 mutations: left operand and right operand', () => {
      // Arrange
      const ctx = createLogicalCtx('x', '||', 'y')

      // Act
      sut.enterLogOrExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(2)
      expect(sut._mutations[0].replacement).toBe('x')
      expect(sut._mutations[1].replacement).toBe('y')
      expect(sut._mutations[0].mutationName).toBe(
        'LogicalOperatorDeletionMutator'
      )
    })
  })

  describe('Given a LogOrExpression where right operand is false (x || false)', () => {
    it('Then should create only 1 mutation: left operand (right is identity for ||)', () => {
      // Arrange
      const ctx = createLogicalCtx('x', '||', 'false')

      // Act
      sut.enterLogOrExpression(ctx)

      // Assert — x || false = x, so "→ x" is equivalent, skipped
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('false')
    })
  })

  describe('Given a LogOrExpression where left operand is false (false || y)', () => {
    it('Then should create only 1 mutation: right operand (left is identity for ||)', () => {
      // Arrange
      const ctx = createLogicalCtx('false', '||', 'y')

      // Act
      sut.enterLogOrExpression(ctx)

      // Assert — false || y = y, so "→ y" is equivalent, skipped
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('false')
    })
  })

  describe('Given a LogOrExpression where both operands are false (false || false)', () => {
    it('Then should create 0 mutations (both sides are identity)', () => {
      // Arrange
      const ctx = createLogicalCtx('false', '||', 'false')

      // Act
      sut.enterLogOrExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given an expression with insufficient children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const ctx = {
        childCount: 2,
        getChild: () => ({}),
      } as unknown as ParserRuleContext

      // Act
      sut.enterLogAndExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given an expression where operator child is not a TerminalNode', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const ctx = {
        childCount: 3,
        getChild: () => ({}),
      } as unknown as ParserRuleContext

      // Act
      sut.enterLogAndExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a context without start/stop tokens', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const operatorNode = new TerminalNode({ text: '&&' } as Token)
      const ctx = {
        childCount: 3,
        text: 'x&&y',
        start: undefined,
        stop: undefined,
        getChild: (index: number) => {
          if (index === 1) return operatorNode
          return { text: 'x' }
        },
      } as unknown as ParserRuleContext

      // Act
      sut.enterLogAndExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given identity operand checks are case-insensitive (x && TRUE)', () => {
    it('Then should skip the equivalent mutation for TRUE (case insensitive)', () => {
      // Arrange
      const ctx = createLogicalCtx('x', '&&', 'TRUE')

      // Act
      sut.enterLogAndExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('TRUE')
    })
  })
})
