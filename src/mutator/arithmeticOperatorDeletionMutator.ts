import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import {
  Arth1ExpressionContext,
  Arth2ExpressionContext,
  AssignExpressionContext,
} from 'apex-parser'
import type { ApexType } from '../type/ApexMethod.js'
import { APEX_TYPE } from '../type/ApexMethod.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

export class ArithmeticOperatorDeletionMutator extends BaseListener {
  private static readonly ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '/'])

  private static readonly NUMERIC_TYPES: ReadonlySet<ApexType> = new Set([
    APEX_TYPE.INTEGER,
    APEX_TYPE.LONG,
    APEX_TYPE.DOUBLE,
    APEX_TYPE.DECIMAL,
  ])

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

    if (operatorText === '+') {
      const methodName = this.typeRegistry
        ? this.getEnclosingMethodName(ctx)
        : null
      if (this.isNonNumericContext(ctx, methodName)) {
        return
      }
    }

    const leftOperand = ctx.getChild(0)
    const rightOperand = ctx.getChild(2)

    if (ctx.start && ctx.stop) {
      this.createMutation(ctx.start, ctx.stop, ctx.text, leftOperand.text)
      this.createMutation(ctx.start, ctx.stop, ctx.text, rightOperand.text)
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
        return !ArithmeticOperatorDeletionMutator.NUMERIC_TYPES.has(
          resolved.apexType
        )
      }
      return false
    }

    return false
  }
}
