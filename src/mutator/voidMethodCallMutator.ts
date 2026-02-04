import { ParserRuleContext } from 'antlr4ts'
import { BaseListener } from './baseListener.js'

export class VoidMethodCallMutator extends BaseListener {
  // Expression contexts that represent method calls
  private readonly METHOD_CALL_CONTEXTS = new Set([
    'MethodCallExpressionContext',
    'DotExpressionContext',
  ])

  // Handle expression statements (method();)
  enterExpressionStatement(ctx: ParserRuleContext): void {
    if (ctx.childCount !== 2) {
      return
    }

    const expression = ctx.getChild(0)

    // Check if the expression is a method call
    const contextName = expression?.constructor?.name
    if (!contextName || !this.METHOD_CALL_CONTEXTS.has(contextName)) {
      return
    }

    // Remove the entire statement (replace with empty string)
    this.createMutationFromParserRuleContext(ctx, '')
  }
}
