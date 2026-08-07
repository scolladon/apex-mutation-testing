import { ParserRuleContext } from 'antlr4ts'
import { BaseListener } from './baseListener.js'

interface WhenControlContext extends ParserRuleContext {
  whenControl(): WhenControlContext[]
}

interface WhenValueContext extends ParserRuleContext {
  ELSE(): unknown
}

export class ExperimentalSwitchMutator extends BaseListener {
  enterSwitchStatement(ctx: ParserRuleContext): void {
    const switchCtx = ctx as WhenControlContext
    const whenControls = switchCtx.whenControl()

    // The length half is an early-out: with no when-clauses the pairwise loops
    // below have no iterations and emit nothing either way.
    // Stryker disable next-line ConditionalExpression: shortcut only.
    if (!whenControls || whenControls.length === 0) {
      return
    }

    const elseCase = whenControls.find(whenCtx => {
      const whenValue = whenCtx.getChild(1) as WhenValueContext
      return whenValue?.ELSE?.() !== undefined
    })

    if (elseCase) {
      // Mutation 1: Remove else case entirely
      this.createMutationFromParserRuleContext(elseCase, '')

      // Mutation 2: Duplicate first case block into else block
      const firstNonElseCase = whenControls.find(whenCtx => {
        const whenValue = whenCtx.getChild(1) as WhenValueContext
        // Child 1 of a when-clause is always a WhenValueContext, and ELSE is
        // always defined on it, so neither `?.` can short-circuit.
        // Stryker disable next-line OptionalChaining: operands are never nullish.
        return whenValue?.ELSE?.() === undefined
      })

      if (firstNonElseCase) {
        const firstCaseBlock = firstNonElseCase.getChild(2) as ParserRuleContext
        const elseBlock = elseCase.getChild(2) as ParserRuleContext

        if (firstCaseBlock?.text && elseBlock) {
          this.createMutationFromParserRuleContext(
            elseBlock,
            firstCaseBlock.text
          )
        }
      }
    }

    // Mutation 3: Swap adjacent when values
    this.createSwapAdjacentValuesMutations(whenControls)
  }

  private isElseCase(whenCtx: ParserRuleContext): boolean {
    const whenValue = whenCtx.getChild(1) as WhenValueContext
    return whenValue?.ELSE?.() !== undefined
  }

  private createSwapAdjacentValuesMutations(
    whenControls: ParserRuleContext[]
  ): void {
    const nonElseCases = whenControls.filter(
      whenCtx => !this.isElseCase(whenCtx)
    )

    for (let i = 0; i < nonElseCases.length - 1; i++) {
      const currentCase = nonElseCases[i]
      const nextCase = nonElseCases[i + 1]

      const currentValue = currentCase.getChild(1) as ParserRuleContext
      const nextValue = nextCase.getChild(1) as ParserRuleContext
      const currentBlock = currentCase.getChild(2) as ParserRuleContext
      const nextBlock = nextCase.getChild(2) as ParserRuleContext

      if (currentValue && nextValue && currentBlock && nextBlock) {
        // Create atomic swap: replace entire span of both when clauses
        // with swapped values (keeping blocks in original positions)
        const originalText = currentCase.text + nextCase.text
        const swappedText = `when ${nextValue.text} ${currentBlock.text}when ${currentValue.text} ${nextBlock.text}`

        if (
          currentCase.start &&
          nextCase.stop &&
          this.isSpanCovered(currentCase.start.line, nextCase.stop.line)
        ) {
          this.createMutation(
            currentCase.start,
            nextCase.stop,
            originalText,
            swappedText
          )
        }
      }
    }
  }

  /**
   * Swap-span mutation spans two when-clauses. The MutationListener only
   * verifies the switch-statement start line is covered; this method asserts
   * coverage for at least one line inside each when-clause so we never emit
   * a mutation whose replacement body is wholly uncovered.
   */
  private isSpanCovered(startLine: number, endLine: number): boolean {
    if (!this._coveredLines) return true
    for (let line = startLine; line <= endLine; line++) {
      if (this._coveredLines.has(line)) return true
    }
    return false
  }
}
