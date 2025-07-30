import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { BaseListener } from './baseListener.js'

export class ArithmeticOperatorMutator extends BaseListener {
  private readonly REPLACEMENT_MAP: Record<string, string[]> = {
    '+': ['-', '*', '/'],
    '-': ['+', '*', '/'],
    '*': ['+', '-', '/'],
    '/': ['+', '-', '*'],
  }

  // Handle MUL, DIV, and MOD operations (*, /, %)
  enterArth1Expression(ctx: ParserRuleContext): void {
    this.processArithmeticOperation(ctx)
  }

  // Handle ADD and SUB operations (+, -)
  enterArth2Expression(ctx: ParserRuleContext): void {
    this.processArithmeticOperation(ctx)
  }

  enterAssignExpression(_ctx: ParserRuleContext): void {
    // Method intentionally left empty - enables traversal into children
  }

  private processArithmeticOperation(ctx: ParserRuleContext): void {
    if (ctx.childCount === 3) {
      const operatorNode = ctx.getChild(1)

      if (operatorNode instanceof TerminalNode) {
        const operatorText = operatorNode.text
        const replacements = this.REPLACEMENT_MAP[operatorText]

        if (replacements) {
          for (const replacement of replacements) {
            this.createMutationFromTerminalNode(operatorNode, replacement)
          }
        }
      }
    }
  }
}
