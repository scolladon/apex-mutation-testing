import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/TerminalNode.js'
import { IncrementMutator } from '../../../src/mutator/incrementMutator.js'

describe('IncrementMutator', () => {
  let sut: IncrementMutator

  beforeEach(() => {
    sut = new IncrementMutator()
  })

  describe('enterPostOpExpression', () => {
    it('should add mutation when encountering post-increment operator', () => {
      // Arrange
      const mockCtx = {
        childCount: 2,
        getChild: jest.fn(index => {
          const terminalNode = new TerminalNode({ text: '++' } as Token)
          return index === 1 ? terminalNode : {}
        }),
      } as unknown as ParserRuleContext

      // Act
      sut['enterPostOpExpression'](mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(1)
      expect(sut['_mutations'][0].replacement).toBe('--')
    })

    it('should add mutation when encountering post-decrement operator', () => {
      // Arrange
      const mockCtx = {
        childCount: 2,
        getChild: jest.fn(index => {
          const terminalNode = new TerminalNode({ text: '--' } as Token)
          return index === 1 ? terminalNode : {}
        }),
      } as unknown as ParserRuleContext

      // Act
      sut['enterPostOpExpression'](mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(1)
      expect(sut['_mutations'][0].replacement).toBe('++')
    })
  })

  describe('enterPreOpExpression', () => {
    it('should add mutation when encountering pre-increment operator', () => {
      // Arrange
      const mockCtx = {
        childCount: 2,
        getChild: jest.fn(index => {
          const terminalNode = new TerminalNode({ text: '++' } as Token)
          return index === 1 ? terminalNode : {}
        }),
      } as unknown as ParserRuleContext

      // Act
      sut['enterPreOpExpression'](mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(1)
      expect(sut['_mutations'][0].replacement).toBe('--')
    })

    it('should add mutation when encountering pre-decrement operator', () => {
      // Arrange
      const mockCtx = {
        childCount: 2,
        getChild: jest.fn(index => {
          const terminalNode = new TerminalNode({ text: '--' } as Token)
          return index === 1 ? terminalNode : {}
        }),
      } as unknown as ParserRuleContext

      // Act
      sut['enterPreOpExpression'](mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(1)
      expect(sut['_mutations'][0].replacement).toBe('++')
    })
  })

  it('should not add mutation when child count is not 2', () => {
    // Arrange
    const mockCtx = {
      childCount: 1,
      getChild: jest.fn(),
    } as unknown as ParserRuleContext

    // Act
    sut['enterPostOpExpression'](mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0)
  })

  it('should not add mutation when operator is not increment/decrement', () => {
    // Arrange
    const mockCtx = {
      childCount: 2,
      getChild: jest.fn().mockImplementation(index => {
        return index === 1 ? { text: '+' } : {}
      }),
    } as unknown as ParserRuleContext

    // Act
    sut['enterPostOpExpression'](mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0)
  })
})
