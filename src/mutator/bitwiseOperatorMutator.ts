import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BaseListener } from './baseListener.js'

export class BitwiseOperatorMutator extends BaseListener {
  private readonly REPLACEMENT_MAP: Record<string, string> = {
    '&': '|',
    '|': '&',
    '^': '&',
  }

  enterBitAndExpression(ctx: ParserRuleContext): void {
    this.processBitwiseOperation(ctx)
  }

  enterBitOrExpression(ctx: ParserRuleContext): void {
    this.processBitwiseOperation(ctx)
  }

  enterBitNotExpression(ctx: ParserRuleContext): void {
    this.processBitwiseOperation(ctx)
  }

  private processBitwiseOperation(ctx: ParserRuleContext): void {
    if (ctx.childCount !== 3) {
      return
    }

    const operatorNode = ctx.getChild(1)

    if (!(operatorNode instanceof TerminalNode)) {
      return
    }

    const operatorText = operatorNode.text
    const replacement = this.REPLACEMENT_MAP[operatorText]

    if (replacement) {
      this.createMutationFromTerminalNode(operatorNode, replacement)
    }
  }
}
