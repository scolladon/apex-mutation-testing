import { BaseListener } from './baseListener.js'

import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'

export class BoundaryConditionMutator extends BaseListener {
  REPLACEMENT_MAP = {
    '!=': '==',
    '==': '!=',
    '<': '<=',
    '<=': '<',
    '>': '>=',
    '>=': '>',
    '===': '!==',
    '!==': '===',
  }

  // Target rule
  // expression: expression ('<=' | '>=' | '>' | '<') expression
  enterParExpression(ctx: ParserRuleContext): void {
    if (ctx.childCount === 3) {
      const symbol = ctx.getChild(1).getChild(1)
      if (symbol instanceof TerminalNode) {
        const symbolText = symbol.text
        const replacement = this.REPLACEMENT_MAP[symbolText]
        if (replacement) {
          this._mutations.push([this.constructor, symbol, replacement])
        }
      }
    }
  }
}
