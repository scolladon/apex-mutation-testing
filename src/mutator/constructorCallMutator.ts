import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ThrowStatementContext } from 'apex-parser'
import { BaseListener } from './baseListener.js'

export class ConstructorCallMutator extends BaseListener {
  // Handle new expressions: new Account() -> null
  enterNewExpression(ctx: ParserRuleContext): void {
    if (ctx.childCount !== 2) {
      return
    }

    const newKeyword = ctx.getChild(0)

    // Verify it's a 'new' keyword
    if (!(newKeyword instanceof TerminalNode)) {
      return
    }

    if (newKeyword.text.toLowerCase() !== 'new') {
      return
    }

    if (this.isInsideThrowStatement(ctx)) {
      return
    }

    // Replace the entire new expression with null
    this.createMutationFromParserRuleContext(ctx, 'null')
  }

  private isInsideThrowStatement(ctx: ParserRuleContext): boolean {
    let current: ParserRuleContext | undefined = ctx.parent as
      | ParserRuleContext
      | undefined
    while (current) {
      if (current instanceof ThrowStatementContext) {
        return true
      }
      current = current.parent as ParserRuleContext | undefined
    }
    return false
  }
}
