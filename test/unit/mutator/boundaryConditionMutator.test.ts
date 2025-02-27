import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BoundaryConditionMutator } from '../../../src/mutator/boundaryConditionMutator.js'

describe('BoundaryConditionMutator', () => {
  let sut: BoundaryConditionMutator
  let mockCtx: ParserRuleContext
  let mockTerminalNode: TerminalNode

  beforeEach(() => {
    // Arrange
    sut = new BoundaryConditionMutator()
    mockCtx = {
      childCount: 3,
      getChild: jest.fn().mockImplementation(index => {
        if (index === 1) {
          return { getChild: jest.fn().mockReturnValue(mockTerminalNode) }
        }
        return {}
      }),
    } as unknown as ParserRuleContext
    mockTerminalNode = {
      text: '==',
    } as unknown as TerminalNode
  })

  it('should mutate equality operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '==' } as Token)

    // Act
    sut.enterParExpression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(1)
    expect(sut['_mutations'][0].replacement).toBe('!=')
  })

  it('should mutate inequality operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '!=' } as Token)

    // Act
    sut.enterParExpression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(1)
    expect(sut['_mutations'][0].replacement).toBe('==')
  })

  it('should mutate less than operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '<' } as Token)

    // Act
    sut.enterParExpression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(1)
    expect(sut['_mutations'][0].replacement).toBe('<=')
  })

  it('should mutate less than or equal operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '<=' } as Token)

    // Act
    sut.enterParExpression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(1)
    expect(sut['_mutations'][0].replacement).toBe('<')
  })

  it('should mutate greater than operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '>' } as Token)

    // Act
    sut.enterParExpression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(1)
    expect(sut['_mutations'][0].replacement).toBe('>=')
  })

  it('should mutate greater than or equal operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '>=' } as Token)

    // Act
    sut.enterParExpression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(1)
    expect(sut['_mutations'][0].replacement).toBe('>')
  })

  it('should mutate strict equality operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '===' } as Token)

    // Act
    sut.enterParExpression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(1)
    expect(sut['_mutations'][0].replacement).toBe('!==')
  })

  it('should mutate strict inequality operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '!==' } as Token)

    // Act
    sut.enterParExpression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(1)
    expect(sut['_mutations'][0].replacement).toBe('===')
  })

  it('should not mutate when child count is not 3', () => {
    // Arrange
    mockCtx = { childCount: 2 } as unknown as ParserRuleContext

    // Act
    sut.enterParExpression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0)
  })

  it('should not mutate when terminal node is not found', () => {
    // Arrange
    mockCtx.getChild = jest.fn().mockImplementation(() => {
      return { getChild: () => null }
    })

    // Act
    sut.enterParExpression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0)
  })

  it('should not mutate when operator is not in replacement map', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: 'unknown' } as Token)

    // Act
    sut.enterParExpression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0)
  })
})
