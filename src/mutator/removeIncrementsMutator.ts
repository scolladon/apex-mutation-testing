import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BaseListener } from './baseListener.js'

export class RemoveIncrementsMutator extends BaseListener {
  // Operators to remove
  private readonly INCREMENT_OPERATORS = new Set(['++', '--'])

  // Handle post-increment/decrement: i++ -> i, i-- -> i
  enterPostOpExpression(ctx: ParserRuleContext): void {
    if (ctx.childCount !== 2) {
      return
    }

    const operatorNode = ctx.getChild(1)

    if (!(operatorNode instanceof TerminalNode)) {
      return
    }

    if (!this.INCREMENT_OPERATORS.has(operatorNode.text)) {
      return
    }

    // Post-op in return is always equivalent: return i++ returns the pre-increment value,
    // identical to return i. The increment side-effect on a local variable is not observed.
    if (this.isInsideReturnStatement(ctx)) {
      return
    }

    // Get the inner expression (the variable)
    const innerExpression = ctx.getChild(0) as ParserRuleContext

    // Replace i++ with i
    this.createMutationFromParserRuleContext(ctx, innerExpression.text)
  }

  // Handle pre-increment/decrement: ++i -> i, --i -> i
  enterPreOpExpression(ctx: ParserRuleContext): void {
    if (ctx.childCount !== 2) {
      return
    }

    const operatorNode = ctx.getChild(0)

    if (!(operatorNode instanceof TerminalNode)) {
      return
    }

    if (!this.INCREMENT_OPERATORS.has(operatorNode.text)) {
      return
    }

    // Get the inner expression (the variable)
    const innerExpression = ctx.getChild(1) as ParserRuleContext

    // Replace ++i with i
    this.createMutationFromParserRuleContext(ctx, innerExpression.text)
  }
}
