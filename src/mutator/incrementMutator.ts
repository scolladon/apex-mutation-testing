import { BaseListener } from './baseListener.js'

import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'

export class IncrementMutator extends BaseListener {
  private REPLACEMENT_MAP: Record<string, string> = {
    '++': '--',
    '--': '++',
  }

  // Target rule
  // expression :
  //  | expression ('++' | '--')
  //  | ('+' | '-' | '++' | '--') expression
  enterPostOpExpression(ctx: ParserRuleContext): void {
    this.processOperation(ctx)
  }

  enterPreOpExpression(ctx: ParserRuleContext): void {
    this.processOperation(ctx)
  }

  private processOperation(ctx: ParserRuleContext) {
    if (ctx.childCount === 2) {
      let symbol: TerminalNode | null = null
      if (ctx.getChild(0) instanceof TerminalNode) {
        symbol = ctx.getChild(0) as TerminalNode
      } else if (ctx.getChild(1) instanceof TerminalNode) {
        symbol = ctx.getChild(1) as TerminalNode
      }

      if (symbol !== null && symbol.text in this.REPLACEMENT_MAP) {
        this._mutations.push({
          mutationName: this.constructor.name,
          target: symbol,
          replacement: this.REPLACEMENT_MAP[symbol.text],
        })
      }
    }
  }
}
