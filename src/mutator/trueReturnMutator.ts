import { ParserRuleContext } from 'antlr4ts'
import { ApexType } from '../type/ApexMethod.js'
import { ReturnTypeAwareBaseListener } from './returnTypeAwareBaseListener.js'

export class TrueReturnMutator extends ReturnTypeAwareBaseListener {
  enterReturnStatement(ctx: ParserRuleContext): void {
    if (!this.isCurrentMethodTypeKnown()) {
      return
    }

    const typeInfo = this.getCurrentMethodReturnTypeInfo()
    if (!typeInfo) {
      return
    }

    if (typeInfo.type !== ApexType.BOOLEAN) {
      return
    }

    if (!ctx.children || ctx.children.length < 2) {
      return
    }

    const expressionNode = ctx.children[1]
    if (!(expressionNode instanceof ParserRuleContext)) {
      return
    }

    if (expressionNode.text.trim().toLowerCase() === 'true') {
      return
    }

    if (expressionNode.start && expressionNode.stop) {
      this._mutations.push({
        mutationName: 'TrueReturn',
        target: {
          startToken: expressionNode.start,
          endToken: expressionNode.stop,
          text: expressionNode.text,
        },
        replacement: 'true',
      })
    }
  }
}
