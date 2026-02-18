import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ApexType } from '../type/ApexMethod.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

export class ArithmeticOperatorMutator extends BaseListener {
  private readonly REPLACEMENT_MAP: Record<string, string[]> = {
    '+': ['-', '*', '/'],
    '-': ['+', '*', '/'],
    '*': ['+', '-', '/'],
    '/': ['+', '-', '*'],
  }

  private static readonly NUMERIC_TYPES = new Set([
    ApexType.INTEGER,
    ApexType.LONG,
    ApexType.DOUBLE,
    ApexType.DECIMAL,
  ])

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
          if (operatorText === '+') {
            const methodName = this.typeRegistry
              ? this.getEnclosingMethodName(ctx)
              : null
            if (this.isNonNumericContext(ctx, methodName)) {
              return
            }
          }

          for (const replacement of replacements) {
            this.createMutationFromTerminalNode(operatorNode, replacement)
          }
        }
      }
    }
  }

  private isNonNumericContext(
    ctx: ParserRuleContext,
    methodName: string | null
  ): boolean {
    const leftText = ctx.getChild(0).text
    const rightText = ctx.getChild(2).text

    return (
      this.isNonNumericOperand(leftText, methodName) ||
      this.isNonNumericOperand(rightText, methodName)
    )
  }

  private isNonNumericOperand(
    text: string,
    methodName: string | null
  ): boolean {
    if (text.includes("'")) {
      return true
    }

    if (this.typeRegistry && methodName) {
      const resolved = this.typeRegistry.resolveType(methodName, text)
      if (resolved) {
        return !ArithmeticOperatorMutator.NUMERIC_TYPES.has(resolved.apexType)
      }
      return false
    }

    return false
  }
}
