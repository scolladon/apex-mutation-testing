import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BaseListener } from './baseListener.js'

export class EqualityConditionMutator extends BaseListener {
  private readonly REPLACEMENT_MAP: Record<string, string> = {
    '==': '!=',
    '!=': '==',
    '===': '!==',
    '!==': '===',
  }

  enterEqualityExpression(ctx: ParserRuleContext): void {
    if (!ctx || ctx.childCount < 3) return

    for (let i = 0; i < ctx.childCount; i++) {
      const child = ctx.getChild(i)

      if (child instanceof TerminalNode) {
        const operatorText = child.text
        const replacement = this.REPLACEMENT_MAP[operatorText]
        if (replacement) {
          this.createMutationFromTerminalNode(child, replacement)
        }
      }
    }
  }
}
