import { ParserRuleContext } from 'antlr4ts'
import { DotExpressionContext, MethodCallExpressionContext } from 'apex-parser'
import { BaseListener } from './baseListener.js'

export class VoidMethodCallMutator extends BaseListener {
  enterExpressionStatement(ctx: ParserRuleContext): void {
    if (ctx.childCount !== 2) {
      return
    }

    const expression = ctx.getChild(0)

    if (
      !(expression instanceof MethodCallExpressionContext) &&
      !(expression instanceof DotExpressionContext)
    ) {
      return
    }

    this.createMutationFromParserRuleContext(ctx, '')
  }
}
