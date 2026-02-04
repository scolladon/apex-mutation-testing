import { ParserRuleContext } from 'antlr4ts'
import { BaseListener } from './baseListener.js'

export class ExperimentalSwitchMutator extends BaseListener {
  enterSwitchStatement(_ctx: ParserRuleContext): void {
    // Not implemented yet
  }
}
