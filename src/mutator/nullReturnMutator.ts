import { ParserRuleContext } from 'antlr4ts'
import { ApexType } from '../type/ApexMethod.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

export class NullReturnMutator extends BaseListener {
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

    if (expressionNode.text.trim().toLowerCase() === 'null') {
      return
    }

    this.createMutationFromParserRuleContext(expressionNode, 'null')
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
    return !!typeInfo && typeInfo.apexType !== ApexType.VOID
  }
}
