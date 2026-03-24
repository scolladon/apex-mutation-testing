import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

export class ArithmeticOperatorMutator extends BaseListener {
  private readonly REPLACEMENT_MAP: Record<string, string[]> = {
    '+': ['-', '*', '/'],
    '-': ['+', '*', '/'],
    '*': ['+', '-', '/'],
    '/': ['+', '-', '*'],
  }

  constructor(typeRegistry?: TypeRegistry) {
    super(typeRegistry)
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
          if (operatorText === '+' && this.isNonNumericContext(ctx)) {
            return
          }

          for (const replacement of replacements) {
            this.createMutationFromTerminalNode(operatorNode, replacement)
          }
        }
      }
    }
  }

  private isNonNumericContext(ctx: ParserRuleContext): boolean {
    const leftText = ctx.getChild(0).text
    const rightText = ctx.getChild(2).text
    if (leftText.includes("'") || rightText.includes("'")) return true
    if (!this.typeRegistry) return false
    const methodName = this.getEnclosingMethodName(ctx)
    if (!methodName) return false
    return (
      !this.typeRegistry.isNumericOperand(methodName, leftText) ||
      !this.typeRegistry.isNumericOperand(methodName, rightText)
    )
  }
}
