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

  describe.each(testCases)(
    '$method',
    ({ method, operator, expectedReplacement }) => {
      it(`should add mutation when encountering ${operator} operator`, () => {
        // Arrange
        const mockCtx = {
          childCount: 2,
          getChild: jest.fn(index => {
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
    }
  )

  const invalidTestCases = [
    {
      description: 'child count is not 2',
      ctx: {
        childCount: 1,
        getChild: jest.fn(),
      },
    },
    {
      description: 'operator is not increment/decrement',
      ctx: {
        childCount: 2,
        getChild: jest.fn().mockImplementation(index => {
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
})
