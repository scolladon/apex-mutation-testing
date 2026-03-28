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
            getChild: vi.fn().mockImplementation(index => {
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
            getChild: vi.fn().mockImplementation(index => {
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
            whenControl: vi.fn().mockReturnValue([regularWhenCtx, elseWhenCtx]),
            getChild: vi.fn(),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert - 2 mutations: remove else + duplicate first into else
          expect(sut._mutations).toHaveLength(2)

          expect(sut._mutations).toContainEqual(
            expect.objectContaining({
              replacement: '',
              target: expect.objectContaining({
                text: 'when else { handleDefault(); }',
              }),
              mutationName: 'ExperimentalSwitchMutator',
            })
          )
          expect(sut._mutations).toContainEqual(
            expect.objectContaining({
              replacement: '{ handle1(); }',
              target: expect.objectContaining({ text: '{ handleDefault(); }' }),
            })
          )
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
            getChild: vi.fn().mockImplementation(index => {
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
            whenControl: vi.fn().mockReturnValue([regularWhenCtx]),
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
            getChild: vi.fn().mockImplementation(index => {
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
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return elseWhenValueCtx
              return elseBlockCtx
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: vi.fn().mockReturnValue([firstWhenCtx, elseWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert
          expect(sut._mutations).toContainEqual(
            expect.objectContaining({
              replacement: '{ handle1(); }',
              target: expect.objectContaining({ text: '{ handleDefault(); }' }),
            })
          )
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
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return elseWhenValueCtx
              return elseBlockCtx
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 5,
            whenControl: vi.fn().mockReturnValue([elseWhenCtx]),
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
            getChild: vi.fn().mockImplementation(index => {
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
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return secondWhenValueCtx
              return secondBlockCtx
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: vi.fn().mockReturnValue([firstWhenCtx, secondWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert - should have ONE atomic swap mutation spanning both when clauses
          // The mutation should swap the entire clauses to avoid duplicate value compilation errors
          expect(sut._mutations).toContainEqual(
            expect.objectContaining({
              target: expect.objectContaining({
                text: 'when 1 { handle1(); }when 2 { handle2(); }',
              }),
              replacement: 'when 2 { handle1(); }when 1 { handle2(); }',
              mutationName: 'ExperimentalSwitchMutator',
            })
          )

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
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return firstWhenValueCtx
              return {
                text: '{ handle1(); }',
              } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 5,
            whenControl: vi.fn().mockReturnValue([firstWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert - no swap mutations
          expect(sut._mutations).toHaveLength(0)
        })
      })
    })

    describe('Given a switch statement with null whenControls', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create any mutations', () => {
          // Arrange
          const switchCtx = {
            childCount: 3,
            whenControl: vi.fn().mockReturnValue(null),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert
          expect(sut._mutations).toHaveLength(0)
        })
      })
    })

    describe('Given a switch statement where first case block has no text', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create duplicate mutation', () => {
          // Arrange
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)
          const elseKeyword = new TerminalNode({ text: 'else' } as Token)

          const firstWhenValueCtx = {
            text: '1',
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const firstWhenCtx = {
            childCount: 3,
            text: 'when 1 {}',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return firstWhenValueCtx
              return { text: '' } as unknown as ParserRuleContext
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
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return elseWhenValueCtx
              return elseBlockCtx
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: vi.fn().mockReturnValue([firstWhenCtx, elseWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert
          const duplicateMutation = sut._mutations.find(
            m =>
              m.target.text === '{ handleDefault(); }' && m.replacement !== ''
          )
          expect(duplicateMutation).toBeUndefined()
        })
      })
    })

    describe('Given a switch statement with empty whenControls', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create any mutations', () => {
          // Arrange
          const switchCtx = {
            childCount: 3,
            whenControl: vi.fn().mockReturnValue([]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert
          expect(sut._mutations).toHaveLength(0)
        })
      })
    })

    describe('Given a switch with two adjacent cases where getChild returns null', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create swap mutation', () => {
          // Arrange
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)

          const firstWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1)
                return {
                  text: '1',
                  ELSE: () => undefined,
                } as unknown as ParserRuleContext
              return null
            }),
          } as unknown as ParserRuleContext

          const secondWhenCtx = {
            childCount: 3,
            text: 'when 2 { handle2(); }',
            start: { tokenIndex: 7, line: 8 } as Token,
            stop: { tokenIndex: 11 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1)
                return {
                  text: '2',
                  ELSE: () => undefined,
                } as unknown as ParserRuleContext
              return null
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: vi.fn().mockReturnValue([firstWhenCtx, secondWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert
          expect(sut._mutations).toHaveLength(0)
        })
      })
    })

    describe('Given a switch with two adjacent cases but missing start/stop tokens', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create swap mutation', () => {
          // Arrange
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)

          const firstWhenValueCtx = {
            text: '1',
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const firstWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: null,
            stop: { tokenIndex: 6 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return firstWhenValueCtx
              return {
                text: '{ handle1(); }',
              } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const secondWhenValueCtx = {
            text: '2',
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const secondWhenCtx = {
            childCount: 3,
            text: 'when 2 { handle2(); }',
            start: { tokenIndex: 7, line: 8 } as Token,
            stop: null,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return secondWhenValueCtx
              return {
                text: '{ handle2(); }',
              } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: vi.fn().mockReturnValue([firstWhenCtx, secondWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert
          expect(sut._mutations).toHaveLength(0)
        })
      })
    })

    describe('Given a switch statement with three adjacent non-else cases', () => {
      describe('When entering the switch statement', () => {
        it('Then should create two atomic swap mutations (one for each adjacent pair)', () => {
          // Arrange
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)

          const makeCase = (
            value: string,
            block: string,
            startIdx: number,
            stopIdx: number,
            line: number
          ) => {
            const valueCtx = {
              text: value,
              ELSE: () => undefined,
            } as unknown as ParserRuleContext
            const blockCtx = {
              text: block,
            } as unknown as ParserRuleContext
            return {
              childCount: 3,
              text: `when ${value} ${block}`,
              start: { tokenIndex: startIdx, line } as Token,
              stop: { tokenIndex: stopIdx } as Token,
              getChild: vi.fn().mockImplementation((index: number) => {
                if (index === 0) return whenKeyword
                if (index === 1) return valueCtx
                return blockCtx
              }),
            } as unknown as ParserRuleContext
          }

          const case1 = makeCase('1', '{ h1(); }', 2, 6, 5)
          const case2 = makeCase('2', '{ h2(); }', 8, 12, 8)
          const case3 = makeCase('3', '{ h3(); }', 14, 18, 11)

          const switchCtx = {
            childCount: 7,
            whenControl: vi.fn().mockReturnValue([case1, case2, case3]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert - two adjacent pair swaps: (1,2) and (2,3)
          expect(sut._mutations).toHaveLength(2)
          expect(sut._mutations[0].target.text).toContain('when 1 { h1(); }')
          expect(sut._mutations[0].target.text).toContain('when 2 { h2(); }')
          expect(sut._mutations[1].target.text).toContain('when 2 { h2(); }')
          expect(sut._mutations[1].target.text).toContain('when 3 { h3(); }')
        })
      })
    })

    describe('Given a switch with when value missing ELSE method entirely', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create else mutation (optional chaining guards against undefined ELSE)', () => {
          // Arrange — whenValue has no ELSE property at all (not even a function returning undefined)
          // This kills the ?.ELSE?.() optional chaining → .ELSE() mutant
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)

          const whenValueWithoutElse = {
            text: '1',
            // No ELSE property at all
          } as unknown as ParserRuleContext

          const regularWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return whenValueWithoutElse
              return {
                text: '{ handle1(); }',
              } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 5,
            whenControl: vi.fn().mockReturnValue([regularWhenCtx]),
          } as unknown as ParserRuleContext

          // Act — should not throw even without ELSE method on whenValue
          expect(() => sut.enterSwitchStatement(switchCtx)).not.toThrow()

          // Assert — no else case found, no mutations
          expect(sut._mutations).toHaveLength(0)
        })
      })
    })

    describe('Given a switch where first non-else case block getChild returns null', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create duplicate mutation (optional chaining guards null block)', () => {
          // Arrange — firstCaseBlock is null, kills ?.text → .text optional chaining mutant
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)
          const elseKeyword = new TerminalNode({ text: 'else' } as Token)

          const firstWhenValueCtx = {
            text: '1',
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const firstWhenCtx = {
            childCount: 3,
            text: 'when 1 {}',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return firstWhenValueCtx
              return null // null block — tests ?.text guard
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
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return elseWhenValueCtx
              return elseBlockCtx
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: vi.fn().mockReturnValue([firstWhenCtx, elseWhenCtx]),
          } as unknown as ParserRuleContext

          // Act — should not throw even with null firstCaseBlock
          expect(() => sut.enterSwitchStatement(switchCtx)).not.toThrow()

          // Assert — only the remove-else mutation, no duplicate mutation
          const duplicateMutation = sut._mutations.find(
            m =>
              m.target.text === '{ handleDefault(); }' && m.replacement !== ''
          )
          expect(duplicateMutation).toBeUndefined()
          // The remove-else mutation should still be created
          expect(sut._mutations).toHaveLength(1)
          expect(sut._mutations[0].replacement).toBe('')
        })
      })
    })

    describe('Given a switch where elseBlock is null', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create duplicate mutation (elseBlock falsy guard)', () => {
          // Arrange — elseBlock is null, kills the && → || mutant on line 40
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
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return firstWhenValueCtx
              return firstBlockCtx
            }),
          } as unknown as ParserRuleContext

          const elseWhenValueCtx = {
            text: 'else',
            ELSE: () => elseKeyword,
          } as unknown as ParserRuleContext

          const elseWhenCtx = {
            childCount: 3,
            text: 'when else {}',
            start: { tokenIndex: 8, line: 10 } as Token,
            stop: { tokenIndex: 12 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return elseWhenValueCtx
              return null // null elseBlock
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: vi.fn().mockReturnValue([firstWhenCtx, elseWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert — no duplicate mutation when elseBlock is null
          const duplicateMutation = sut._mutations.find(
            m => m.replacement === '{ handle1(); }'
          )
          expect(duplicateMutation).toBeUndefined()
        })
      })
    })

    describe('Given a switch where nextBlock is null for adjacent cases', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create swap mutation (nextBlock null guard in && chain)', () => {
          // Arrange — currentValue and nextValue exist but nextBlock is null
          // Kills individual && → || mutants in the compound condition on line 74
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)

          const firstWhenValueCtx = {
            text: '1',
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const firstBlockCtx = {
            text: '{ handle1(); }',
          } as unknown as ParserRuleContext

          const firstWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return firstWhenValueCtx
              return firstBlockCtx
            }),
          } as unknown as ParserRuleContext

          const secondWhenValueCtx = {
            text: '2',
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const secondWhenCtx = {
            childCount: 3,
            text: 'when 2 { handle2(); }',
            start: { tokenIndex: 7, line: 8 } as Token,
            stop: { tokenIndex: 11 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return secondWhenValueCtx
              return null // null nextBlock
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: vi.fn().mockReturnValue([firstWhenCtx, secondWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert — no swap mutation when nextBlock is null
          expect(sut._mutations).toHaveLength(0)
        })
      })
    })

    describe('Given a switch where nextValue is null for adjacent cases', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create swap mutation (nextValue null guard in && chain)', () => {
          // Arrange — kills the nextValue && mutant
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)

          const firstWhenValueCtx = {
            text: '1',
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const firstBlockCtx = {
            text: '{ handle1(); }',
          } as unknown as ParserRuleContext

          const firstWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return firstWhenValueCtx
              return firstBlockCtx
            }),
          } as unknown as ParserRuleContext

          const secondBlockCtx = {
            text: '{ handle2(); }',
          } as unknown as ParserRuleContext

          const secondWhenCtx = {
            childCount: 3,
            text: 'when 2 { handle2(); }',
            start: { tokenIndex: 7, line: 8 } as Token,
            stop: { tokenIndex: 11 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return null // null nextValue
              return secondBlockCtx
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: vi.fn().mockReturnValue([firstWhenCtx, secondWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert — no swap mutation when nextValue is null
          expect(sut._mutations).toHaveLength(0)
        })
      })
    })

    describe('Given a switch where currentValue is null for adjacent cases', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create swap mutation (currentValue null guard in && chain)', () => {
          // Arrange — kills the currentValue && mutant
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)

          const secondWhenValueCtx = {
            text: '2',
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const secondBlockCtx = {
            text: '{ handle2(); }',
          } as unknown as ParserRuleContext

          const firstWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return null // null currentValue
              return { text: '{ handle1(); }' } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const secondWhenCtx = {
            childCount: 3,
            text: 'when 2 { handle2(); }',
            start: { tokenIndex: 7, line: 8 } as Token,
            stop: { tokenIndex: 11 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return secondWhenValueCtx
              return secondBlockCtx
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: vi.fn().mockReturnValue([firstWhenCtx, secondWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert — no swap mutation when currentValue is null
          expect(sut._mutations).toHaveLength(0)
        })
      })
    })

    describe('Given a switch with two adjacent non-else cases but only nextCase.stop is null', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create swap mutation (nextCase.stop null guard)', () => {
          // Arrange — currentCase.start is present but nextCase.stop is null
          // Kills the currentCase.start && nextCase.stop → || mutation on line 80
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)

          const firstWhenValueCtx = {
            text: '1',
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const firstWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: { tokenIndex: 2, line: 5 } as Token,
            stop: { tokenIndex: 6 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return firstWhenValueCtx
              return { text: '{ handle1(); }' } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const secondWhenValueCtx = {
            text: '2',
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const secondWhenCtx = {
            childCount: 3,
            text: 'when 2 { handle2(); }',
            start: { tokenIndex: 7, line: 8 } as Token,
            stop: null, // null stop — distinguishes && from ||
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return secondWhenValueCtx
              return { text: '{ handle2(); }' } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: vi.fn().mockReturnValue([firstWhenCtx, secondWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert — no mutation when nextCase.stop is null
          expect(sut._mutations).toHaveLength(0)
        })
      })
    })

    describe('Given a switch with two adjacent non-else cases and only currentCase.start is null', () => {
      describe('When entering the switch statement', () => {
        it('Then should not create swap mutation (currentCase.start null guard)', () => {
          // Arrange — currentCase.start is null but nextCase.stop exists
          // Kills the currentCase.start && nextCase.stop → || mutation on line 80
          const whenKeyword = new TerminalNode({ text: 'when' } as Token)

          const firstWhenValueCtx = {
            text: '1',
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const firstWhenCtx = {
            childCount: 3,
            text: 'when 1 { handle1(); }',
            start: null, // null start
            stop: { tokenIndex: 6 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return firstWhenValueCtx
              return { text: '{ handle1(); }' } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const secondWhenValueCtx = {
            text: '2',
            ELSE: () => undefined,
          } as unknown as ParserRuleContext

          const secondWhenCtx = {
            childCount: 3,
            text: 'when 2 { handle2(); }',
            start: { tokenIndex: 7, line: 8 } as Token,
            stop: { tokenIndex: 11 } as Token,
            getChild: vi.fn().mockImplementation(index => {
              if (index === 0) return whenKeyword
              if (index === 1) return secondWhenValueCtx
              return { text: '{ handle2(); }' } as unknown as ParserRuleContext
            }),
          } as unknown as ParserRuleContext

          const switchCtx = {
            childCount: 6,
            whenControl: vi.fn().mockReturnValue([firstWhenCtx, secondWhenCtx]),
          } as unknown as ParserRuleContext

          // Act
          sut.enterSwitchStatement(switchCtx)

          // Assert — no mutation when currentCase.start is null
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
            getChild: vi.fn().mockImplementation(index => {
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
            getChild: vi.fn().mockImplementation(index => {
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
            whenControl: vi.fn().mockReturnValue([firstWhenCtx, elseWhenCtx]),
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
