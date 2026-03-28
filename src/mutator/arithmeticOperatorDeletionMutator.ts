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
      // Skip "→ left" when right is the identity element (a OP identity = a)
      if (
        !ArithmeticOperatorDeletionMutator.isRightIdentity(
          operatorText,
          rightOperand.text
        )
      ) {
        this.createMutation(ctx.start, ctx.stop, ctx.text, leftOperand.text)
      }
      // Skip "→ right" when left is the identity element (identity OP b = b)
      if (
        !ArithmeticOperatorDeletionMutator.isLeftIdentity(
          operatorText,
          leftOperand.text
        )
      ) {
        this.createMutation(ctx.start, ctx.stop, ctx.text, rightOperand.text)
      }
    }
  }

  private static isRightIdentity(
    operator: string,
    operandText: string
  ): boolean {
    if (operator === '+' || operator === '-') {
      return ArithmeticOperatorDeletionMutator.isLiteralZero(operandText)
    }
    return ArithmeticOperatorDeletionMutator.isLiteralOne(operandText)
  }

  private static isLeftIdentity(
    operator: string,
    operandText: string
  ): boolean {
    if (operator === '+') {
      return ArithmeticOperatorDeletionMutator.isLiteralZero(operandText)
    }
    if (operator === '*') {
      return ArithmeticOperatorDeletionMutator.isLiteralOne(operandText)
    }
    return false
  }

  private static isLiteralZero(text: string): boolean {
    return /^0[lL]?$|^0\.0+[dDfF]?$/.test(text)
  }

  private static isLiteralOne(text: string): boolean {
    return /^1[lL]?$|^1\.0+[dDfF]?$/.test(text)
  }
}
