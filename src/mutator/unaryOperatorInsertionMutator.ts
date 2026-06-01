import { ParserRuleContext } from 'antlr4ts'
import {
  ArrayExpressionContext,
  DotExpressionContext,
  IdPrimaryContext,
} from 'apex-parser'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

export class UnaryOperatorInsertionMutator extends BaseListener {
  constructor(typeRegistry?: TypeRegistry) {
    super(typeRegistry)
  }

  enterPrimaryExpression(ctx: ParserRuleContext): void {
    if (this.isNonAssignableReceiver(ctx)) {
      return
    }

    if (ctx.childCount !== 1) {
      return
    }

    const primary = ctx.getChild(0)
    if (!(primary instanceof IdPrimaryContext)) {
      return
    }

    const text = primary.text

    if (this.typeRegistry) {
      const methodName = this.getEnclosingMethodName(ctx)
      if (methodName && !this.typeRegistry.isNumericOperand(methodName, text)) {
        return
      }
    }

    if (ctx.start && ctx.stop) {
      // Post-op mutations (x++, x--) inside a return statement are always equivalent:
      // return x++ returns the pre-increment value, identical to return x.
      const inReturn = this.isInsideReturnStatement(ctx)
      if (!inReturn) {
        this.createMutation(ctx.start, ctx.stop, text, `${text}++`)
      }
      this.createMutation(ctx.start, ctx.stop, text, `++${text}`)
      if (!inReturn) {
        this.createMutation(ctx.start, ctx.stop, text, `${text}--`)
      }
      this.createMutation(ctx.start, ctx.stop, text, `--${text}`)
    }
  }

  // The receiver of a dot (`a.b`) or array (`a[i]`) access is not an assignable
  // target: `a++.b` / `a++[i]` are invalid. The index of `a[i]` is assignable, so
  // only the receiver (first child) of an ArrayExpression is rejected.
  private isNonAssignableReceiver(ctx: ParserRuleContext): boolean {
    const parent = ctx.parent
    return (
      parent instanceof DotExpressionContext ||
      (parent instanceof ArrayExpressionContext && parent.expression(0) === ctx)
    )
  }
}
