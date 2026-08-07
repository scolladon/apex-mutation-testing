import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BaseListener } from './baseListener.js'

// The operator of a two-child increment expression, whichever side it sits on
// (`++x` vs `x++`). Written as sequential returns rather than an if/else chain
// so each arm can carry its own coverage annotation.
const operatorTerminalOf = (ctx: ParserRuleContext): TerminalNode | null => {
  const first = ctx.getChild(0)
  if (first instanceof TerminalNode) {
    return first
  }
  const second = ctx.getChild(1)
  // Not observable: the caller only uses the node via `text in REPLACEMENT_MAP`
  // and a non-terminal's text is never a key there, so dropping this type test
  // emits no mutation either way.
  // Stryker disable next-line ConditionalExpression: filtered by REPLACEMENT_MAP.
  if (second instanceof TerminalNode) {
    return second
  }
  return null
}

export class IncrementMutator extends BaseListener {
  private REPLACEMENT_MAP: Record<string, string> = {
    '++': '--',
    '--': '++',
  }

  // Target rule
  // expression :
  //  | expression ('++' | '--')
  //  | ('+' | '-' | '++' | '--') expression
  enterPostOpExpression(ctx: ParserRuleContext): void {
    this.processOperation(ctx)
  }

  enterPreOpExpression(ctx: ParserRuleContext): void {
    this.processOperation(ctx)
  }

  private processOperation(ctx: ParserRuleContext) {
    if (ctx.childCount === 2) {
      const operatorNode = operatorTerminalOf(ctx)

      if (operatorNode !== null && operatorNode.text in this.REPLACEMENT_MAP) {
        this.createMutationFromTerminalNode(
          operatorNode,
          this.REPLACEMENT_MAP[operatorNode.text]
        )
      }
    }
  }
}
