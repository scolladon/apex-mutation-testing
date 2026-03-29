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
      getChild: vi.fn().mockImplementation((index: number) => children[index]),
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

    it('Given childCount of 2 with a valid TerminalNode < operator, When enterCmpExpression, Then should not create mutation (kills childCount < 3 → < 2 mutant)', () => {
      // Arrange — kills `childCount < 3` → `childCount < 2` mutant:
      // With original `< 3`: 2 < 3 = true → returns early → 0 mutations.
      // With mutant `< 2`: 2 < 2 = false → does NOT return → loops over children → finds '<' TerminalNode →
      // operatorText='<' → REPLACEMENT_MAP['<']='<=' → operatorTokens.length>0 → creates mutation.
      // This distinguishes the original from the mutant.
      const operatorToken = {
        text: '<',
        line: 1,
        charPositionInLine: 10,
        tokenIndex: 1,
        startIndex: 10,
        stopIndex: 10,
      } as Token

      const operatorNode: TerminalNode = {
        text: '<',
        symbol: operatorToken,
      } as unknown as TerminalNode
      Object.setPrototypeOf(operatorNode, TerminalNode.prototype)

      const children = [{ text: 'leftOperand' }, operatorNode]

      const mockCtx = {
        childCount: 2,
        getChild: vi
          .fn()
          .mockImplementation((index: number) => children[index]),
        children,
      } as unknown as ParserRuleContext

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert — original guard fires (2 < 3 → true → return) → 0 mutations
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
        getChild: vi.fn().mockReturnValue({ text: 'notTerminalNode' }),
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
        getChild: vi
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
        getChild: vi
          .fn()
          .mockImplementation((index: number) => children[index]),
        children,
      } as unknown as ParserRuleContext

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it('Given a TerminalNode with operator text not in replacement map but valid symbol, When enterCmpExpression, Then no mutation is created (kills && to || mutant)', () => {
      // Arrange — operatorText='!' is in the includes list but not in REPLACEMENT_MAP
      // With &&→|| mutant: (undefined || operatorTokens.length > 0) = true → mutation attempted
      const operatorToken: Token = {
        text: '!',
        line: 1,
        charPositionInLine: 10,
        tokenIndex: 1,
        startIndex: 10,
        stopIndex: 10,
      } as Token

      const exclamationNode: TerminalNode = {
        text: '!',
        symbol: operatorToken,
      } as unknown as TerminalNode
      Object.setPrototypeOf(exclamationNode, TerminalNode.prototype)

      const children = [
        { text: 'leftOperand' },
        exclamationNode,
        { text: 'rightOperand' },
      ]

      const mockCtx = {
        childCount: 3,
        getChild: vi
          .fn()
          .mockImplementation((index: number) => children[index]),
        children,
      } as unknown as ParserRuleContext

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it('Given a non-TerminalNode child with operator text, When enterCmpExpression, Then no mutation is created (kills instanceof→true mutant)', () => {
      // Arrange — plain object with text '<' is NOT a TerminalNode
      // With instanceof→true mutant: the plain object is processed, its undefined symbol passes !== null check,
      // a null token is added to operatorTokens and createMutation is called with undefined tokens
      const plainOperatorNode = {
        text: '<',
        symbol: undefined,
      }

      const children = [
        { text: 'leftOperand' },
        plainOperatorNode,
        { text: 'rightOperand' },
      ]

      const mockCtx = {
        childCount: 3,
        getChild: vi
          .fn()
          .mockImplementation((index: number) => children[index]),
        children,
      } as unknown as ParserRuleContext

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it('Given a TerminalNode with non-operator text preceding a valid operator TerminalNode, When enterCmpExpression, Then mutation is created only for the valid operator (kills includes→true mutant)', () => {
      // Arrange — with includes→true mutant: 'a' is also processed, corrupting operatorText to 'a<'
      // which has no REPLACEMENT_MAP entry, so no mutation would be created
      const nonOperatorToken: Token = {
        text: 'a',
        line: 1,
        charPositionInLine: 9,
        tokenIndex: 1,
        startIndex: 9,
        stopIndex: 9,
      } as Token
      const nonOperatorNode: TerminalNode = {
        text: 'a',
        symbol: nonOperatorToken,
      } as unknown as TerminalNode
      Object.setPrototypeOf(nonOperatorNode, TerminalNode.prototype)

      const operatorToken: Token = {
        text: '<',
        line: 1,
        charPositionInLine: 10,
        tokenIndex: 2,
        startIndex: 10,
        stopIndex: 10,
      } as Token
      const operatorNode: TerminalNode = {
        text: '<',
        symbol: operatorToken,
      } as unknown as TerminalNode
      Object.setPrototypeOf(operatorNode, TerminalNode.prototype)

      const children = [
        { text: 'leftOperand' },
        nonOperatorNode,
        operatorNode,
        { text: 'rightOperand' },
      ]

      const mockCtx = {
        childCount: 4,
        getChild: vi
          .fn()
          .mockImplementation((index: number) => children[index]),
        children,
      } as unknown as ParserRuleContext

      // Act
      sut.enterCmpExpression(mockCtx)

      // Assert — only the '<' operator is counted; 'a' is not in includes so operatorText='<'
      expect(sut['_mutations']).toHaveLength(1)
      expect(sut['_mutations'][0].replacement).toBe('<=')
    })
  })
})
