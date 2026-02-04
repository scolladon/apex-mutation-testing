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

      if (currentValue && nextValue) {
        // Swap current value with next value
        this.createMutationFromParserRuleContext(currentValue, nextValue.text)
        this.createMutationFromParserRuleContext(nextValue, currentValue.text)
      }
    }
  }
}
