import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BaseListener } from './baseListener.js'

export class InvertNegativesMutator extends BaseListener {
  // Handle unary minus expressions: -x, -5, etc.
  // PreOpExpression has structure: [operator, expression]
  enterPreOpExpression(ctx: ParserRuleContext): void {
    if (ctx.childCount !== 2) {
      return
    }

    const operatorNode = ctx.getChild(0)

    if (!(operatorNode instanceof TerminalNode)) {
      return
    }

    // Only handle unary minus, not ++ or --
    if (operatorNode.text !== '-') {
      return
    }

    const innerExpression = ctx.getChild(1) as ParserRuleContext

    // Replace -x with x (remove the negation)
    this.createMutationFromParserRuleContext(ctx, innerExpression.text)
  }
}
