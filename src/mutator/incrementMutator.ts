import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BaseListener } from './baseListener.js'

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
      let operatorNode: TerminalNode | null = null
      if (ctx.getChild(0) instanceof TerminalNode) {
        operatorNode = ctx.getChild(0) as TerminalNode
      } else if (ctx.getChild(1) instanceof TerminalNode) {
        operatorNode = ctx.getChild(1) as TerminalNode
      }

      if (operatorNode !== null && operatorNode.text in this.REPLACEMENT_MAP) {
        this.createMutationFromTerminalNode(
          operatorNode,
          this.REPLACEMENT_MAP[operatorNode.text]
        )
      }
    }
  }
}
