import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/TerminalNode.js'
import { IncrementMutator } from '../../../src/mutator/incrementMutator.js'

describe('IncrementMutator', () => {
  let sut: IncrementMutator

  beforeEach(() => {
    sut = new IncrementMutator()
  })

  const testCases = [
    {
      description: 'post-increment operator',
      method: 'enterPostOpExpression',
      operator: '++',
      expectedReplacement: '--',
    },
    {
      description: 'post-decrement operator',
      method: 'enterPostOpExpression',
      operator: '--',
      expectedReplacement: '++',
    },
    {
      description: 'pre-increment operator',
      method: 'enterPreOpExpression',
      operator: '++',
      expectedReplacement: '--',
    },
    {
      description: 'pre-decrement operator',
      method: 'enterPreOpExpression',
      operator: '--',
      expectedReplacement: '++',
    },
  ]

  describe.each(testCases)('$method', ({
    method,
    operator,
    expectedReplacement,
  }) => {
    it(`should add mutation when encountering ${operator} operator`, () => {
      // Arrange
      const mockCtx = {
        childCount: 2,
        getChild: vi.fn(index => {
          const terminalNode = new TerminalNode({ text: operator } as Token)
          return index === 1 ? terminalNode : {}
        }),
      } as unknown as ParserRuleContext

      // Act
      sut[method](mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(1)
      expect(sut['_mutations'][0].replacement).toBe(expectedReplacement)
    })
  })

  const invalidTestCases = [
    {
      description: 'child count is not 2',
      ctx: {
        childCount: 1,
        getChild: vi.fn(),
      },
    },
    {
      description: 'operator is not increment/decrement',
      ctx: {
        childCount: 2,
        getChild: vi.fn().mockImplementation(index => {
          return index === 1 ? { text: '+' } : {}
        }),
      },
    },
  ]

  describe.each(invalidTestCases)('When $description', ({ ctx }) => {
    it('should not add mutation', () => {
      // Arrange
      const mockCtx = ctx as unknown as ParserRuleContext

      // Act
      sut['enterPostOpExpression'](mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })
  })

  describe('Given a pre-increment operator at child index 0 (++i form)', () => {
    it('Given pre-op ++ at index 0, When enterPreOpExpression, Then should create mutation replacing ++ with --', () => {
      // Arrange — pre-op: child[0]=operator, child[1]=operand (e.g., ++i)
      const operator = new TerminalNode({ text: '++' } as Token)
      const mockCtx = {
        childCount: 2,
        getChild: vi.fn(index => {
          return index === 0 ? operator : { text: 'i' }
        }),
      } as unknown as ParserRuleContext

      // Act
      sut['enterPreOpExpression'](mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(1)
      expect(sut['_mutations'][0].replacement).toBe('--')
    })

    it('Given pre-op -- at index 0, When enterPreOpExpression, Then should create mutation replacing -- with ++', () => {
      // Arrange — pre-op: child[0]=operator, child[1]=operand (e.g., --i)
      const operator = new TerminalNode({ text: '--' } as Token)
      const mockCtx = {
        childCount: 2,
        getChild: vi.fn(index => {
          return index === 0 ? operator : { text: 'i' }
        }),
      } as unknown as ParserRuleContext

      // Act
      sut['enterPreOpExpression'](mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(1)
      expect(sut['_mutations'][0].replacement).toBe('++')
    })

    it('Given ++ at index 0 and -- at index 1, When enterPreOpExpression, Then mutation uses the index-0 operator (kills else→if mutant)', () => {
      // Arrange — with the else removed, child[1] overrides child[0] and replacement becomes ++ instead of --
      const operatorAtZero = new TerminalNode({ text: '++' } as Token)
      const operatorAtOne = new TerminalNode({ text: '--' } as Token)
      const mockCtx = {
        childCount: 2,
        getChild: vi.fn(index => {
          return index === 0 ? operatorAtZero : operatorAtOne
        }),
      } as unknown as ParserRuleContext

      // Act
      sut['enterPreOpExpression'](mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(1)
      expect(sut['_mutations'][0].replacement).toBe('--')
    })
  })

  describe('Given childCount not equal to 2', () => {
    it('Given childCount 3 with ++ at index 1, When enterPostOpExpression, Then no mutation is created (kills childCount===2→true mutant)', () => {
      // Arrange — with === 2 → true mutant: the guard is skipped, child[1] is a TerminalNode ++ → mutation created
      const operatorNode = new TerminalNode({ text: '++' } as Token)
      const mockCtx = {
        childCount: 3,
        getChild: vi.fn(index => {
          if (index === 0) return { text: 'x' }
          if (index === 1) return operatorNode
          return { text: 'y' }
        }),
      } as unknown as ParserRuleContext

      // Act
      sut['enterPostOpExpression'](mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })
  })
})
