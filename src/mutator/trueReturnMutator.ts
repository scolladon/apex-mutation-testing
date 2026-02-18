import { ParserRuleContext } from 'antlr4ts'
import { APEX_TYPE } from '../type/ApexMethod.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

export class TrueReturnMutator extends BaseListener {
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
    if (!this.typeRegistry) {
      return false
    }
    const methodName = this.getEnclosingMethodName(ctx)
    if (!methodName) {
      return false
    }
    const typeInfo = this.typeRegistry.resolveType(methodName)
    return !!typeInfo && typeInfo.apexType === APEX_TYPE.BOOLEAN
  }
}
