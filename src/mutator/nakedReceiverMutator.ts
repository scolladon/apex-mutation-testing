import { DotExpressionContext } from 'apex-parser'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { resolveDotMethodCall } from './astUtils.js'
import { BaseListener } from './baseListener.js'

export class NakedReceiverMutator extends BaseListener {
  constructor(typeRegistry?: TypeRegistry) {
    super(typeRegistry)
  }

  enterDotExpression(ctx: DotExpressionContext): void {
    if (!this.typeRegistry) {
      return
    }

    const info = resolveDotMethodCall(ctx, this.typeRegistry)
    if (!info) {
      return
    }

    const receiverText = ctx.children![0].text
    const receiverType = this.typeRegistry.resolveType(
      info.enclosingMethod,
      receiverText
    )
    if (!receiverType) {
      return
    }

    if (receiverType.apexType === info.returnType.apexType) {
      this.createMutationFromParserRuleContext(ctx, receiverText)
    }
  }
}
