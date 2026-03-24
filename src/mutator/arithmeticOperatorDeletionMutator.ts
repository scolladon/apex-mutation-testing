import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import {
  Arth1ExpressionContext,
  Arth2ExpressionContext,
  AssignExpressionContext,
} from 'apex-parser'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

export class ArithmeticOperatorDeletionMutator extends BaseListener {
  private static readonly ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '/'])

  constructor(typeRegistry?: TypeRegistry) {
    super(typeRegistry)
  }

  enterArth1Expression(ctx: Arth1ExpressionContext): void {
    this.processArithmeticDeletion(ctx)
  }

  enterArth2Expression(ctx: Arth2ExpressionContext): void {
    this.processArithmeticDeletion(ctx)
  }

  enterAssignExpression(_ctx: AssignExpressionContext): void {
    // Method intentionally left empty - enables traversal into children
  }

  private processArithmeticDeletion(ctx: ParserRuleContext): void {
    if (ctx.childCount !== 3) {
      return
    }

    const operatorNode = ctx.getChild(1)
    if (!(operatorNode instanceof TerminalNode)) {
      return
    }

    const operatorText = operatorNode.text
    if (
      !ArithmeticOperatorDeletionMutator.ARITHMETIC_OPERATORS.has(operatorText)
    ) {
      return
    }

    if (operatorText === '+' && this.isNonNumericContext(ctx)) {
      return
    }

    const leftOperand = ctx.getChild(0)
    const rightOperand = ctx.getChild(2)

    if (ctx.start && ctx.stop) {
      this.createMutation(ctx.start, ctx.stop, ctx.text, leftOperand.text)
      this.createMutation(ctx.start, ctx.stop, ctx.text, rightOperand.text)
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
