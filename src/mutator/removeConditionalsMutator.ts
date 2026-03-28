import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BaseListener } from './baseListener.js'

export class RemoveConditionalsMutator extends BaseListener {
  // Handle if statements: if (condition) -> if (true) or if (false)
  enterIfStatement(ctx: ParserRuleContext): void {
    // if statement structure: 'if', parExpression, statement, ['else', statement]
    if (ctx.childCount < 3) {
      return
    }

    const ifKeyword = ctx.getChild(0)

    // Verify it's an 'if' keyword
    if (!(ifKeyword instanceof TerminalNode)) {
      return
    }

    if (ifKeyword.text.toLowerCase() !== 'if') {
      return
    }

    // Get the condition (child 1 is the ParExpression)
    const conditionCtx = ctx.getChild(1) as ParserRuleContext

    const conditionText = conditionCtx.text.toLowerCase()

    // Replace condition with (true) - always execute if block
    // Skip if already (true): replacing (true) → (true) is a no-op
    if (conditionText !== '(true)') {
      this.createMutationFromParserRuleContext(conditionCtx, '(true)')
    }

    // Replace condition with (false) - never execute if block
    // Skip if already (false): replacing (false) → (false) is a no-op
    if (conditionText !== '(false)') {
      this.createMutationFromParserRuleContext(conditionCtx, '(false)')
    }
  }
}
