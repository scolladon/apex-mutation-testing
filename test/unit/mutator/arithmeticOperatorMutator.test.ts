import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ArithmeticOperatorMutator } from '../../../src/mutator/arithmeticMutator.js'

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
})
