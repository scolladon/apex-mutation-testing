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
    // Unreachable via the parser: a bare `return;` only occurs in a void
    // method, which isEligibleReturnType already rejects, so child 1 is always
    // the returned expression here.
    // Stryker disable next-line ConditionalExpression,BlockStatement: unreachable.
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
    // Not observable: a return statement always sits inside a method, and even
    // without one `resolveType(undefined)` misses the table and the caller
    // treats the absent type info exactly the same way.
    // Stryker disable next-line ConditionalExpression,BlockStatement: same result either way.
    if (!methodName) {
      return false
    }
    const typeInfo = this.typeRegistry.resolveType(methodName)
    return !!typeInfo && this.isEligibleReturnType(typeInfo.apexType)
  }
}
