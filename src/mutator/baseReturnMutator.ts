import { ParserRuleContext } from 'antlr4ts'
import { ApexType } from '../type/ApexMethod.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

export abstract class BaseReturnMutator extends BaseListener {
  constructor(
    private readonly returnValue: string,
    typeRegistry?: TypeRegistry
  ) {
    super(typeRegistry)
  }

  enterReturnStatement(ctx: ParserRuleContext): void {
    if (!this.isMutableReturn(ctx)) {
      return
    }

    if (!ctx.children || ctx.children.length < 2) {
      return
    }

    const expressionNode = ctx.children[1]
    if (!(expressionNode instanceof ParserRuleContext)) {
      return
    }

    if (expressionNode.text.trim().toLowerCase() === this.returnValue) {
      return
    }

    this.createMutationFromParserRuleContext(expressionNode, this.returnValue)
  }

  protected abstract isEligibleReturnType(apexType: ApexType): boolean

  private isMutableReturn(ctx: ParserRuleContext): boolean {
    if (!this.typeRegistry) {
      return false
    }
    const methodName = this.getEnclosingMethodName(ctx)
    if (!methodName) {
      return false
    }
    const typeInfo = this.typeRegistry.resolveType(methodName)
    return !!typeInfo && this.isEligibleReturnType(typeInfo.apexType)
  }
}
