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
      getChild: vi.fn().mockImplementation((index: number) => {
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

  it('should mutate === to !==', () => {
    // Arrange
    const mockCtx = createMockContext('===')

    // Act
    mutator.enterEqualityExpression(mockCtx)

    // Assert
    expect(mutator['_mutations']).toHaveLength(1)
    expect(mutator['_mutations'][0].replacement).toBe('!==')
  })

  it('should mutate !== to ===', () => {
    // Arrange
    const mockCtx = createMockContext('!==')

    // Act
    mutator.enterEqualityExpression(mockCtx)

    // Assert
    expect(mutator['_mutations']).toHaveLength(1)
    expect(mutator['_mutations'][0].replacement).toBe('===')
  })

  it('Given null context, When enterEqualityExpression, Then no mutation is added', () => {
    // Arrange — covers the !ctx branch
    const nullCtx = null as unknown as ParserRuleContext

    // Act
    mutator.enterEqualityExpression(nullCtx)

    // Assert
    expect(mutator['_mutations']).toHaveLength(0)
  })

  it('should not mutate when child count is insufficient', () => {
    const mockCtx = { childCount: 2 } as unknown as ParserRuleContext
    mutator.enterEqualityExpression(mockCtx)
    expect(mutator['_mutations']).toHaveLength(0)
  })

  it('should not mutate when operator has no replacement mapping', () => {
    // Arrange
    const unmappedOperator: TerminalNode = {
      text: '+',
      symbol: { text: '+' } as Token,
    } as unknown as TerminalNode
    Object.setPrototypeOf(unmappedOperator, TerminalNode.prototype)

    const children = [{ text: 'a' }, unmappedOperator, { text: 'b' }]
    const mockCtx = {
      childCount: 3,
      children,
      getChild: vi.fn().mockImplementation((index: number) => children[index]),
    } as unknown as ParserRuleContext

    // Act
    mutator.enterEqualityExpression(mockCtx)

    // Assert
    expect(mutator['_mutations']).toHaveLength(0)
  })

  it('Given a non-TerminalNode child with operator text in replacement map and valid symbol, When enterEqualityExpression, Then no mutation is created (kills instanceof → true mutant)', () => {
    // Arrange — kills `child instanceof TerminalNode` → `true` mutant:
    // With true, every child is "processed". Left operand { text: '==', symbol: ... } would create a mutation.
    // Original code: plain object is not a TerminalNode → skipped. Only actual TerminalNode at index 1 creates 1 mutation.
    const mockToken: Token = {
      text: '==',
      line: 1,
      charPositionInLine: 5,
      tokenIndex: 1,
      startIndex: 5,
      stopIndex: 6,
    } as Token

    const realTerminalNode: TerminalNode = {
      text: '==',
      symbol: mockToken,
    } as unknown as TerminalNode
    Object.setPrototypeOf(realTerminalNode, TerminalNode.prototype)

    // left operand is a PLAIN object (not TerminalNode) but has text '==' and symbol
    // With instanceof → true mutant: this would also create a mutation → 2 total instead of 1
    const plainNodeWithOperatorText = {
      text: '==',
      symbol: mockToken,
    }

    const children = [
      plainNodeWithOperatorText,
      realTerminalNode,
      { text: 'b' },
    ]
    const mockCtx = {
      childCount: 3,
      children,
      getChild: vi.fn().mockImplementation((index: number) => children[index]),
    } as unknown as ParserRuleContext

    // Act
    mutator.enterEqualityExpression(mockCtx)

    // Assert — only the real TerminalNode at index 1 should create a mutation, not the plain object
    expect(mutator['_mutations']).toHaveLength(1)
    expect(mutator['_mutations'][0].replacement).toBe('!=')
  })
})
