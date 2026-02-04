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
  }
}
