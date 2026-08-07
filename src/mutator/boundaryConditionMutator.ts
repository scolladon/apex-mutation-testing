import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BaseListener } from './baseListener.js'

export class BoundaryConditionMutator extends BaseListener {
  private readonly REPLACEMENT_MAP: Record<string, string> = {
    '<': '<=',
    '<=': '<',
    '>': '>=',
    '>=': '>',
  }

  enterCmpExpression(ctx: ParserRuleContext): void {
    if (ctx.childCount < 3) return

    let operatorText = ''
    const operatorTokens: { node: TerminalNode; token: Token }[] = []

    for (let i = 0; i < ctx.childCount; i++) {
      const child = ctx.getChild(i)
      if (child instanceof TerminalNode) {
        const text = child.text

        // '!' is unreachable: the lexer emits `!=` as a single token, so no
        // comparison ever yields a lone '!' terminal. ('>=' does split into
        // '>' and '=', which is why those entries are live.)
        // Stryker disable next-line StringLiteral: lone '!' is never emitted.
        if (['>', '<', '=', '!'].includes(text)) {
          operatorText += text
          if (child.symbol !== null) {
            operatorTokens.push({ node: child, token: child.symbol })
          }
        }
      }
    }

    const replacement = this.REPLACEMENT_MAP[operatorText]

    if (replacement && operatorTokens.length > 0) {
      const startToken = operatorTokens[0].token
      const endToken = operatorTokens[operatorTokens.length - 1].token
      this.createMutation(startToken, endToken, operatorText, replacement)
    }
  }
}
