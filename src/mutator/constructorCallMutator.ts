import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
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

    // Replace the entire new expression with null
    this.createMutationFromParserRuleContext(ctx, 'null')
  }
}
