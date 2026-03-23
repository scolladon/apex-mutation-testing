import { ParserRuleContext } from 'antlr4ts'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

export class UnaryOperatorInsertionMutator extends BaseListener {
  constructor(typeRegistry?: TypeRegistry) {
    super(typeRegistry)
  }

  enterPrimaryExpression(ctx: ParserRuleContext): void {
    if (ctx.childCount !== 1) {
      return
    }

    const primary = ctx.getChild(0)
    if (!(primary instanceof ParserRuleContext)) {
      return
    }

    const text = primary.text

    if (this.isLiteral(text)) {
      return
    }

    if (text === 'this' || text === 'super') {
      return
    }

    const methodName = this.typeRegistry
      ? this.getEnclosingMethodName(ctx)
      : null
    if (this.isNonNumericOperand(text, methodName)) {
      return
    }

    if (ctx.start && ctx.stop) {
      this.createMutation(ctx.start, ctx.stop, text, `${text}++`)
      this.createMutation(ctx.start, ctx.stop, text, `++${text}`)
      this.createMutation(ctx.start, ctx.stop, text, `${text}--`)
      this.createMutation(ctx.start, ctx.stop, text, `--${text}`)
    }
  }

  private isLiteral(text: string): boolean {
    if (/^\d/.test(text)) return true
    if (text.startsWith("'")) return true
    const lower = text.toLowerCase()
    if (lower === 'true' || lower === 'false' || lower === 'null') return true
    return false
  }
}
