import { DotExpressionContext, DotMethodCallContext } from 'apex-parser'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

export class NakedReceiverMutator extends BaseListener {
  constructor(typeRegistry?: TypeRegistry) {
    super(typeRegistry)
  }

  enterDotExpression(ctx: DotExpressionContext): void {
    if (!ctx.children || ctx.children.length < 3) {
      return
    }

    const lastChild = ctx.children[ctx.children.length - 1]
    if (!(lastChild instanceof DotMethodCallContext)) {
      return
    }

    if (!lastChild.children || lastChild.children.length < 3) {
      return
    }

    const methodName = lastChild.children[0].text
    const enclosingMethod = this.getEnclosingMethodName(ctx)
    if (!this.typeRegistry || !enclosingMethod) {
      return
    }

    const methodReturnType = this.typeRegistry.resolveType(
      enclosingMethod,
      `${methodName}()`
    )
    if (!methodReturnType) {
      return
    }

    const receiver = ctx.children[0]
    const receiverText = receiver.text
    const receiverType = this.typeRegistry.resolveType(
      enclosingMethod,
      receiverText
    )
    if (!receiverType) {
      return
    }

    if (receiverType.apexType === methodReturnType.apexType) {
      this.createMutationFromParserRuleContext(ctx, receiverText)
    }
  }
}
