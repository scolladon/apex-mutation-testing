import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ArithmeticOperatorMutator } from '../../../src/mutator/arithmeticOperatorMutator.js'

describe('ArithmeticOperatorMutator', () => {
  let sut: ArithmeticOperatorMutator
  let mockCtx: ParserRuleContext
  let mockTerminalNode: TerminalNode

  beforeEach(() => {
    // Arrange
    sut = new ArithmeticOperatorMutator()
    mockCtx = {
      childCount: 3,
      getChild: jest.fn().mockImplementation(index => {
        return index === 1 ? mockTerminalNode : {}
      }),
    } as unknown as ParserRuleContext
    mockTerminalNode = {
      text: '+',
    } as unknown as TerminalNode
  })

  it('should mutate addition operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '+' } as Token)

    // Act
    sut.enterArth2Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(3)
    expect(sut['_mutations'][0].replacement).toBe('-')
    expect(sut['_mutations'][1].replacement).toBe('*')
    expect(sut['_mutations'][2].replacement).toBe('/')
  })

  it('should mutate subtraction operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '-' } as Token)

    // Act
    sut.enterArth2Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(3)
    expect(sut['_mutations'][0].replacement).toBe('+')
    expect(sut['_mutations'][1].replacement).toBe('*')
    expect(sut['_mutations'][2].replacement).toBe('/')
  })

  it('should mutate multiplication operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '*' } as Token)

    // Act
    sut.enterArth1Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(3)
    expect(sut['_mutations'][0].replacement).toBe('+')
    expect(sut['_mutations'][1].replacement).toBe('-')
    expect(sut['_mutations'][2].replacement).toBe('/')
  })

  it('should mutate division operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '/' } as Token)

    // Act
    sut.enterArth1Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(3)
    expect(sut['_mutations'][0].replacement).toBe('+')
    expect(sut['_mutations'][1].replacement).toBe('-')
    expect(sut['_mutations'][2].replacement).toBe('*')
  })

  it('should not mutate when child count is not 3', () => {
    // Arrange
    mockCtx = { childCount: 2 } as unknown as ParserRuleContext

    // Act
    sut.enterArth1Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0)
  })

  it('should not mutate when terminal node is not found', () => {
    // Arrange
    mockCtx.getChild = jest.fn().mockReturnValue({})

    // Act
    sut.enterArth1Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0)
  })

  it('should not mutate when operator is not in replacement map', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '==' } as Token)

    // Act
    sut.enterArth1Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0)
  })

  // New tests for the assignment expression handling
  it('should have an enterAssignExpression method', () => {
    // Assert
    expect(typeof sut.enterAssignExpression).toBe('function')
  })

  it('enterAssignExpression should not directly create mutations', () => {
    // Arrange
    const assignCtx = {
      childCount: 3,
      getChild: jest.fn().mockImplementation(index => {
        // Right side is an arithmetic expression
        if (index === 2) {
          return {
            // Arth2Expression in the actual parse tree
          }
        }
        return {}
      }),
    } as unknown as ParserRuleContext

    // Act
    sut.enterAssignExpression(assignCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0) // No mutations directly from enterAssignExpression
  })

  it('should process arithmetic operations in assignment expressions via traversal', () => {

    // Arrange
    const assignCtx = {
      childCount: 3,
      getChild: jest.fn().mockImplementation(index => {
        return index === 2
          ? {
              // Represents the right side (which will be visited separately by the parser)
            }
          : {}
      }),
    } as unknown as ParserRuleContext

    const arithmeticCtx = {
      childCount: 3,
      getChild: jest.fn().mockImplementation(index => {
        return index === 1 ? mockTerminalNode : {}
      }),
    } as unknown as ParserRuleContext

    mockTerminalNode = new TerminalNode({ text: '+' } as Token)

    // Act
    // First the parser would call enterAssignExpression
    sut.enterAssignExpression(assignCtx)

    // Then it would find and call enterArth2Expression on the right side
    sut.enterArth2Expression(arithmeticCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(3)
    expect(sut['_mutations'][0].replacement).toBe('-')
  })
})
