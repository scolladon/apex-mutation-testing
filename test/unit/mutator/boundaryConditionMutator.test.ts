import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BoundaryConditionMutator } from '../../../src/mutator/boundaryConditionMutator.js'

describe('BoundaryConditionMutator', () => {
  let sut: BoundaryConditionMutator

  beforeEach(() => {
    sut = new BoundaryConditionMutator()
  })

  function createMockContext(operatorText: string): ParserRuleContext {
    // Compound operators like <= and >= are treated as a separate tokens for each char
    const tokens: Token[] = []
    const terminalNodes: TerminalNode[] = []

    for (let i = 0; i < operatorText.length; i++) {
      const char = operatorText[i]
      const mockToken: Token = {
        text: char,
        line: 1,
        charPositionInLine: 10 + i,
        tokenIndex: i + 1,
        startIndex: 10 + i,
        stopIndex: 10 + i,
      } as Token

      const mockTerminalNode: TerminalNode = {
        text: char,
        symbol: mockToken,
        constructor: { name: 'TerminalNode' },
      } as TerminalNode

      Object.setPrototypeOf(mockTerminalNode, TerminalNode.prototype)

      tokens.push(mockToken)
      terminalNodes.push(mockTerminalNode)
    }

    const children = [
      { text: 'leftOperand' },
      ...terminalNodes,
      { text: 'rightOperand' },
    ]

    return {
      childCount: children.length,
      getChild: jest
        .fn()
        .mockImplementation((index: number) => children[index]),
      children,
    } as unknown as ParserRuleContext
  }

  describe('comparison operators', () => {
    it('should mutate less than operator', () => {
      // Arrange
      const mockCtx = createMockContext('<')

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(1)
      expect(sut['_mutations'][0].replacement).toBe('<=')
      expect(sut['_mutations'][0].mutationName).toBe('BoundaryConditionMutator')
    })

    it('should mutate less than or equal operator', () => {
      // Arrange
      const mockCtx = createMockContext('<=')

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(1)
      expect(sut['_mutations'][0].replacement).toBe('<')
    })

    it('should mutate greater than operator', () => {
      // Arrange
      const mockCtx = createMockContext('>')

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(1)
      expect(sut['_mutations'][0].replacement).toBe('>=')
    })

    it('should mutate greater than or equal operator', () => {
      // Arrange
      const mockCtx = createMockContext('>=')

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(1)
      expect(sut['_mutations'][0].replacement).toBe('>')
    })
  })

  describe('edge cases', () => {
    it('should not mutate when child count is less than 3', () => {
      // Arrange
      const mockCtx = { childCount: 2 } as unknown as ParserRuleContext

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it('should not mutate when operator is not in replacement map', () => {
      // Arrange
      const mockCtx = createMockContext('==')

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it('should not mutate when no terminal node is found', () => {
      // Arrange
      const mockCtx = {
        childCount: 3,
        getChild: jest.fn().mockReturnValue({ text: 'notTerminalNode' }),
        children: [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
      } as unknown as ParserRuleContext

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it('should ignore terminal node with non-operator text', () => {
      // Arrange
      const nonOperatorNode: TerminalNode = {
        text: '(',
        symbol: { text: '(' } as Token,
      } as unknown as TerminalNode
      Object.setPrototypeOf(nonOperatorNode, TerminalNode.prototype)

      const children = [
        { text: 'leftOperand' },
        nonOperatorNode,
        { text: 'rightOperand' },
      ]

      const mockCtx = {
        childCount: 3,
        getChild: jest
          .fn()
          .mockImplementation((index: number) => children[index]),
        children,
      } as unknown as ParserRuleContext

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it('should skip terminal node with null symbol', () => {
      // Arrange
      const nullSymbolNode: TerminalNode = {
        text: '<',
        symbol: null,
      } as unknown as TerminalNode
      Object.setPrototypeOf(nullSymbolNode, TerminalNode.prototype)

      const children = [
        { text: 'leftOperand' },
        nullSymbolNode,
        { text: 'rightOperand' },
      ]

      const mockCtx = {
        childCount: 3,
        getChild: jest
          .fn()
          .mockImplementation((index: number) => children[index]),
        children,
      } as unknown as ParserRuleContext

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })
  })
})
