import { ParserRuleContext } from 'antlr4ts'
import { ApexType } from '../type/ApexMethod.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { ReturnTypeAwareBaseListener } from './returnTypeAwareBaseListener.js'

export class TrueReturnMutator extends ReturnTypeAwareBaseListener {
  constructor(typeRegistry?: TypeRegistry) {
    super(typeRegistry)
  }

  enterReturnStatement(ctx: ParserRuleContext): void {
    if (!this.shouldMutate(ctx)) {
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

    this.createMutationFromParserRuleContext(expressionNode, 'true')
  }

  private shouldMutate(ctx: ParserRuleContext): boolean {
    if (this.typeRegistry) {
      const methodName = this.getEnclosingMethodName(ctx)
      if (!methodName) {
        return false
      }
      const typeInfo = this.typeRegistry.resolveType(methodName)
      return !!typeInfo && typeInfo.apexType === ApexType.BOOLEAN
    }

    if (!this.isCurrentMethodTypeKnown()) {
      return false
    }
    const typeInfo = this.getCurrentMethodReturnTypeInfo()
    return !!typeInfo && typeInfo.type === ApexType.BOOLEAN
  }
}
