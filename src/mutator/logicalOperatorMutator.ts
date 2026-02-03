import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BaseListener } from './baseListener.js'

export class LogicalOperatorMutator extends BaseListener {
  private readonly REPLACEMENT_MAP: Record<string, string> = {
    '&&': '||',
    '||': '&&',
  }

  // Handle && (logical AND) expressions
  enterLogAndExpression(ctx: ParserRuleContext): void {
    this.processLogicalOperation(ctx)
  }

  // Handle || (logical OR) expressions
  enterLogOrExpression(ctx: ParserRuleContext): void {
    this.processLogicalOperation(ctx)
  }

  private processLogicalOperation(ctx: ParserRuleContext): void {
    if (ctx.childCount === 3) {
      const operatorNode = ctx.getChild(1)

      if (operatorNode instanceof TerminalNode) {
        const operatorText = operatorNode.text
        const replacement = this.REPLACEMENT_MAP[operatorText]

        if (replacement) {
          this.createMutationFromTerminalNode(operatorNode, replacement)
        }
      }
    }
  }
}
