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
      this.createMutationFromParserRuleContext(elseCase, '')
    }
  }
}
