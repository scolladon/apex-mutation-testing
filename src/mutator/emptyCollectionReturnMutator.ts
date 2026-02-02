import { ParserRuleContext } from 'antlr4ts'
import { ApexType } from '../type/ApexMethod.js'
import { ReturnTypeAwareBaseListener } from './returnTypeAwareBaseListener.js'

export class EmptyCollectionReturnMutator extends ReturnTypeAwareBaseListener {
  private readonly COLLECTION_TYPES = new Set([
    ApexType.LIST,
    ApexType.SET,
    ApexType.MAP,
  ])

  enterReturnStatement(ctx: ParserRuleContext): void {
    if (!this.isCurrentMethodTypeKnown()) {
      return
    }

    const typeInfo = this.getCurrentMethodReturnTypeInfo()
    if (!typeInfo) {
      return
    }

    if (!this.COLLECTION_TYPES.has(typeInfo.type)) {
      return
    }

    if (!ctx.children || ctx.children.length < 2) {
      return
    }

    const expressionNode = ctx.children[1]
    if (!(expressionNode instanceof ParserRuleContext)) {
      return
    }

    const emptyCollection = `new ${typeInfo.returnType}()`

    // Skip if already returning empty collection
    if (
      expressionNode.text.replace(/\s+/g, '') ===
      emptyCollection.replace(/\s+/g, '')
    ) {
      return
    }

    this.createMutationFromParserRuleContext(expressionNode, emptyCollection)
  }
}
