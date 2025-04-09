import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BaseListener } from './baseListener.js'

export class ArithmeticOperatorReplacementMutator extends BaseListener {
  private REPLACEMENT_MAP: Record<string, string[]> = {
    '+': ['-', '*', '/'],
    '-': ['+', '*', '/'],
    '*': ['+', '-', '/'],
    '/': ['+', '-', '*'],
  }

  // Handle MUL and DIV operations
  enterArth1Expression(ctx: ParserRuleContext): void {
    this.processArithmeticOperation(ctx)
  }

  // Handle ADD and SUB operations
  enterArth2Expression(ctx: ParserRuleContext): void {
    this.processArithmeticOperation(ctx)
  }

  // Signal to the parser that we want to traverse into assignment expressions
  enterAssignExpression(_ctx: ParserRuleContext): void {
    // Method intentionally left empty - its presence enables traversal into children
  }

  private processArithmeticOperation(ctx: ParserRuleContext) {
    if (ctx.childCount === 3) {
      const operatorNode = ctx.getChild(1)
      if (operatorNode instanceof TerminalNode) {
        const operatorText = operatorNode.text
        const replacements = this.REPLACEMENT_MAP[operatorText]

        if (replacements) {
          // Create a mutation for each possible replacement
          for (const replacement of replacements) {
            this._mutations.push({
              mutationName: this.constructor.name,
              token: operatorNode,
              replacement,
            })
          }
        }
      }
    }
  }
}
