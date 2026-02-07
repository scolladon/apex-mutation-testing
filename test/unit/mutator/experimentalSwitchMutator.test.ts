import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ExperimentalSwitchMutator } from '../../../src/mutator/experimentalSwitchMutator.js'

describe('ExperimentalSwitchMutator', () => {
  let sut: ExperimentalSwitchMutator

  beforeEach(() => {
    sut = new ExperimentalSwitchMutator()
  })

  describe('Remove default/else mutation', () => {
    describe('Given a switch statement with when else case', () => {
      describe('When entering the switch statement', () => {
        it('Then should create mutation to remove the else case entirely', () => {
          // Arrange
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)
          const elseKeyword = new TerminalNode({ text: 'else' } as Token)

          const whenValueCtx = {
            text: 'else',
            ELSE: () => elseKeyword,
            childCount: 1,
            getChild: () => elseKeyword,
          } as unknown as ParserRuleContext

          const blockCtx = {
            text: '{ handleDefault(); }',
            start: { tokenIndex: 10 } as Token,
            stop: { tokenIndex: 15 } as Token,
          } as unknown as ParserRuleContext

          const elseWhenCtx = {
            childCount: 3,
            text: 'when else { handleDefault(); }',
            start: { tokenIndex: 8, line: 10 } as Token,
            stop: { tokenIndex: 15 } as Token,
            getChild: jest.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return whenValueCtx
              return blockCtx
            }),
          } as unknown as ParserRuleContext

          const regularWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: jest.fn().mockImplementation(index => {
              if (index === 0)
                return new TerminalNode({ text: 'when' } as Token)
              if (index === 1)
                return {
                  text: '1',
                  ELSE: () => undefined,
                } as unknown as ParserRuleContext
              return {
                text: '{ handle1(); }',
                start: { tokenIndex: 4 } as Token,
                stop: { tokenIndex: 6 } as Token,
              } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            text: 'switch on value { when 1 { handle1(); } when else { handleDefault(); } }',
            start: { tokenIndex: 0, line: 4 } as Token,
            stop: { tokenIndex: 16 } as Token,
            whenControl: jest
              .fn()
              .mockReturnValue([regularWhenCtx, elseWhenCtx]),
            getChild: jest.fn(),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert - 2 mutations: remove else + duplicate first into else
          expect(sut._mutations).toHaveLength(2)

          const removeMutation = sut._mutations.find(m => m.replacement === '')
          expect(removeMutation).toBeDefined()
          expect(removeMutation?.target.text).toBe(
            'when else { handleDefault(); }'
          )
          expect(removeMutation?.mutationName).toBe('ExperimentalSwitchMutator')

          const duplicateMutation = sut._mutations.find(
            m => m.replacement === '{ handle1(); }'
          )
          expect(duplicateMutation).toBeDefined()
          expect(duplicateMutation?.target.text).toBe('{ handleDefault(); }')
        })
      })
    })

    describe('Given a switch statement without when else case', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create any mutations', () => {
          // Arrange
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)

          const regularWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: jest.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1)
                return {
                  text: '1',
                  ELSE: () => undefined,
                } as unknown as ParserRuleContext
              return {
                text: '{ handle1(); }',
              } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 5,
            whenControl: jest.fn().mockReturnValue([regularWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert
          expect(sut._mutations).toHaveLength(0)
        })
      })
    })
  })

  describe('Duplicate first case into default mutation', () => {
    describe('Given a switch statement with first case and else case', () => {
      describe('When entering the switch statement', () => {
        it('Then should create mutation to replace else block with first case block', () => {
          // Arrange
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)
          const elseKeyword = new TerminalNode({ text: 'else' } as Token)

          const firstBlockCtx = {
            text: '{ handle1(); }',
            start: { tokenIndex: 4 } as Token,
            stop: { tokenIndex: 6 } as Token,
          } as unknown as ParserRuleContext

          const firstWhenValueCtx = {
            text: '1',
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const firstWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: jest.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return firstWhenValueCtx
              return firstBlockCtx
            }),
          } as unknown as ParserRuleContext

          const elseBlockCtx = {
            text: '{ handleDefault(); }',
            start: { tokenIndex: 10 } as Token,
            stop: { tokenIndex: 15 } as Token,
          } as unknown as ParserRuleContext

          const elseWhenValueCtx = {
            text: 'else',
            ELSE: () => elseKeyword,
          } as unknown as ParserRuleContext

          const elseWhenCtx = {
            childCount: 3,
            text: 'when else { handleDefault(); }',
            start: { tokenIndex: 8, line: 10 } as Token,
            stop: { tokenIndex: 15 } as Token,
            getChild: jest.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return elseWhenValueCtx
              return elseBlockCtx
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: jest.fn().mockReturnValue([firstWhenCtx, elseWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert
          const duplicateMutation = sut._mutations.find(
            m => m.replacement === '{ handle1(); }'
          )
          expect(duplicateMutation).toBeDefined()
          expect(duplicateMutation?.target.text).toBe('{ handleDefault(); }')
        })
      })
    })

    describe('Given a switch statement with only else case', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create duplicate mutation', () => {
          // Arrange
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)
          const elseKeyword = new TerminalNode({ text: 'else' } as Token)

          const elseBlockCtx = {
            text: '{ handleDefault(); }',
            start: { tokenIndex: 10 } as Token,
            stop: { tokenIndex: 15 } as Token,
          } as unknown as ParserRuleContext

          const elseWhenValueCtx = {
            text: 'else',
            ELSE: () => elseKeyword,
          } as unknown as ParserRuleContext

          const elseWhenCtx = {
            childCount: 3,
            text: 'when else { handleDefault(); }',
            start: { tokenIndex: 8, line: 10 } as Token,
            stop: { tokenIndex: 15 } as Token,
            getChild: jest.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return elseWhenValueCtx
              return elseBlockCtx
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 5,
            whenControl: jest.fn().mockReturnValue([elseWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert - should only have the remove mutation, not duplicate
          const duplicateMutation = sut._mutations.find(
            m =>
              m.target.text === '{ handleDefault(); }' && m.replacement !== ''
          )
          expect(duplicateMutation).toBeUndefined()
        })
      })
    })
  })

  describe('Swap adjacent when values mutation', () => {
    describe('Given a switch statement with two adjacent non-else cases', () => {
      describe('When entering the switch statement', () => {
        it('Then should create a single atomic mutation that swaps both when clauses', () => {
          // Arrange
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)

          const firstBlockCtx = {
            text: '{ handle1(); }',
            start: { tokenIndex: 4 } as Token,
            stop: { tokenIndex: 6 } as Token,
          } as unknown as ParserRuleContext

          const firstWhenValueCtx = {
            text: '1',
            start: { tokenIndex: 3 } as Token,
            stop: { tokenIndex: 3 } as Token,
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const firstWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: jest.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return firstWhenValueCtx
              return firstBlockCtx
            }),
          } as unknown as ParserRuleContext

          const secondBlockCtx = {
            text: '{ handle2(); }',
            start: { tokenIndex: 9 } as Token,
            stop: { tokenIndex: 11 } as Token,
          } as unknown as ParserRuleContext

          const secondWhenValueCtx = {
            text: '2',
            start: { tokenIndex: 8 } as Token,
            stop: { tokenIndex: 8 } as Token,
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const secondWhenCtx = {
            childCount: 3,
            text: 'when 2 { handle2(); }',
            start: { tokenIndex: 7, line: 8 } as Token,
            stop: { tokenIndex: 11 } as Token,
            getChild: jest.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return secondWhenValueCtx
              return secondBlockCtx
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: jest
              .fn()
              .mockReturnValue([firstWhenCtx, secondWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert - should have ONE atomic swap mutation spanning both when clauses
          // The mutation should swap the entire clauses to avoid duplicate value compilation errors
          const swapMutation = sut._mutations.find(
            m =>
              m.target.text === 'when 1 { handle1(); }when 2 { handle2(); }' &&
              m.replacement === 'when 2 { handle1(); }when 1 { handle2(); }'
          )
          expect(swapMutation).toBeDefined()
          expect(swapMutation?.mutationName).toBe('ExperimentalSwitchMutator')

          // Should NOT have individual swap mutations that would cause compilation errors
          const individualSwapMutation = sut._mutations.find(
            m =>
              (m.target.text === '1' && m.replacement === '2') ||
              (m.target.text === '2' && m.replacement === '1')
          )
          expect(individualSwapMutation).toBeUndefined()
        })
      })
    })

    describe('Given a switch statement with only one non-else case', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create swap mutations', () => {
          // Arrange
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)

          const firstWhenValueCtx = {
            text: '1',
            start: { tokenIndex: 3 } as Token,
            stop: { tokenIndex: 3 } as Token,
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const firstWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: jest.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return firstWhenValueCtx
              return {
                text: '{ handle1(); }',
              } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 5,
            whenControl: jest.fn().mockReturnValue([firstWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert - no swap mutations
          expect(sut._mutations).toHaveLength(0)
        })
      })
    })

    describe('Given a switch with non-else case followed by else case', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create swap mutation between them', () => {
          // Arrange
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)
          const elseKeyword = new TerminalNode({ text: 'else' } as Token)

          const firstWhenValueCtx = {
            text: '1',
            start: { tokenIndex: 3 } as Token,
            stop: { tokenIndex: 3 } as Token,
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const firstWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: jest.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return firstWhenValueCtx
              return {
                text: '{ handle1(); }',
                start: { tokenIndex: 4 } as Token,
                stop: { tokenIndex: 6 } as Token,
              } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const elseWhenValueCtx = {
            text: 'else',
            start: { tokenIndex: 8 } as Token,
            stop: { tokenIndex: 8 } as Token,
            ELSE: () => elseKeyword,
          } as unknown as ParserRuleContext

          const elseWhenCtx = {
            childCount: 3,
            text: 'when else { handleDefault(); }',
            start: { tokenIndex: 7, line: 8 } as Token,
            stop: { tokenIndex: 12 } as Token,
            getChild: jest.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return elseWhenValueCtx
              return {
                text: '{ handleDefault(); }',
                start: { tokenIndex: 9 } as Token,
                stop: { tokenIndex: 12 } as Token,
              } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: jest.fn().mockReturnValue([firstWhenCtx, elseWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert - no swap mutations (only remove-else and duplicate mutations)
          const swapMutation = sut._mutations.find(
            m => m.target.text === '1' && m.replacement === 'else'
          )
          expect(swapMutation).toBeUndefined()
        })
      })
    })
  })
})
