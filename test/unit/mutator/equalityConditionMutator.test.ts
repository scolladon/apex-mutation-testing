import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { EqualityConditionMutator } from '../../../src/mutator/equalityConditionMutator.js'

describe('EqualityConditionMutator', () => {
  let mutator: EqualityConditionMutator

  beforeEach(() => {
    mutator = new EqualityConditionMutator()
  })

  function createMockContext(operatorText: string): ParserRuleContext {
    const mockToken: Token = {
      text: operatorText,
      line: 1,
      charPositionInLine: 10,
      tokenIndex: 1,
      startIndex: 10,
      stopIndex: 10 + operatorText.length - 1,
    } as Token

    const mockTerminalNode: TerminalNode = {
      text: operatorText,
      symbol: mockToken,
    } as TerminalNode

    Object.setPrototypeOf(mockTerminalNode, TerminalNode.prototype)

    return {
      childCount: 3,
      getChild: jest.fn().mockImplementation((index: number) => {
        if (index === 1) return mockTerminalNode
        return { text: 'operand' }
      }),
      children: [
        { text: 'leftOperand' },
        mockTerminalNode,
        { text: 'rightOperand' },
      ],
    } as unknown as ParserRuleContext
  }

  it('should mutate == to !=', () => {
    const mockCtx = createMockContext('==')
    mutator.enterEqualityExpression(mockCtx)
    expect(mutator['_mutations']).toHaveLength(1)
    expect(mutator['_mutations'][0].replacement).toBe('!=')
  })

  it('should mutate != to ==', () => {
    const mockCtx = createMockContext('!=')
    mutator.enterEqualityExpression(mockCtx)
    expect(mutator['_mutations']).toHaveLength(1)
    expect(mutator['_mutations'][0].replacement).toBe('==')
  })

  it('should not mutate when child count is insufficient', () => {
    const mockCtx = { childCount: 2 } as unknown as ParserRuleContext
    mutator.enterEqualityExpression(mockCtx)
    expect(mutator['_mutations']).toHaveLength(0)
  })
})
