import { ParserRuleContext } from 'antlr4ts'
import { DotExpressionContext, IdPrimaryContext } from 'apex-parser'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

export class UnaryOperatorInsertionMutator extends BaseListener {
  constructor(typeRegistry?: TypeRegistry) {
    super(typeRegistry)
  }

  enterPrimaryExpression(ctx: ParserRuleContext): void {
    if (ctx.parent instanceof DotExpressionContext) {
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
}
