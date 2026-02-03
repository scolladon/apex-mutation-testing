import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BaseListener } from './baseListener.js'

export class SwitchMutator extends BaseListener {
  // Handle when control blocks: when 1 { code } -> when 1 {}
  enterWhenControl(ctx: ParserRuleContext): void {
    // WhenControl structure: 'when', whenValue, block
    if (ctx.childCount !== 3) {
      return
    }

    const whenKeyword = ctx.getChild(0)

    // Verify it's a 'when' keyword
    if (!(whenKeyword instanceof TerminalNode)) {
      return
    }

    if (whenKeyword.text.toLowerCase() !== 'when') {
      return
    }

    // Get the block (child 2)
    const blockCtx = ctx.getChild(2) as ParserRuleContext

    // Replace block with empty block
    this.createMutationFromParserRuleContext(blockCtx, '{}')
  }
}
