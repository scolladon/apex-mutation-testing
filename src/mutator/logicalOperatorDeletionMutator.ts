import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BaseListener } from './baseListener.js'

export class LogicalOperatorDeletionMutator extends BaseListener {
  enterLogAndExpression(ctx: ParserRuleContext): void {
    this.processDeletion(ctx, '&&')
  }

  enterLogOrExpression(ctx: ParserRuleContext): void {
    this.processDeletion(ctx, '||')
  }

  private processDeletion(ctx: ParserRuleContext, operator: '&&' | '||'): void {
    if (ctx.childCount !== 3) {
      return
    }

    const operatorNode = ctx.getChild(1)
    if (!(operatorNode instanceof TerminalNode)) {
      return
    }

    if (!ctx.start || !ctx.stop) {
      return
    }

    const leftOperand = ctx.getChild(0)
    const rightOperand = ctx.getChild(2)

    // Skip "→ left" when right is the identity element (a OP identity = a)
    if (
      !LogicalOperatorDeletionMutator.isIdentityOperand(
        operator,
        rightOperand.text
      )
    ) {
      this.createMutation(ctx.start, ctx.stop, ctx.text, leftOperand.text)
    }
    // Skip "→ right" when left is the identity element (identity OP b = b)
    if (
      !LogicalOperatorDeletionMutator.isIdentityOperand(
        operator,
        leftOperand.text
      )
    ) {
      this.createMutation(ctx.start, ctx.stop, ctx.text, rightOperand.text)
    }
  }

  private static isIdentityOperand(
    operator: '&&' | '||',
    operandText: string
  ): boolean {
    const lower = operandText.toLowerCase()
    return operator === '&&' ? lower === 'true' : lower === 'false'
  }
}
