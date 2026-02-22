import { ParserRuleContext } from 'antlr4ts'
import { DotExpressionContext, MethodCallExpressionContext } from 'apex-parser'
import type { ApexType } from '../type/ApexMethod.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import {
  extractArguments,
  resolveDotMethodCall,
  resolveExpressionApexType,
} from './astUtils.js'
import { BaseListener } from './baseListener.js'

export class ArgumentPropagationMutator extends BaseListener {
  constructor(typeRegistry?: TypeRegistry) {
    super(typeRegistry)
  }

  enterMethodCallExpression(ctx: MethodCallExpressionContext): void {
    if (ctx.childCount !== 1) {
      return
    }

    const methodCall = ctx.getChild(0)
    if (!(methodCall instanceof ParserRuleContext)) {
      return
    }
    if (!methodCall.children || methodCall.children.length < 3) {
      return
    }

    const methodName = methodCall.children[0].text
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

    const args = extractArguments(methodCall)
    if (args.length === 0) {
      return
    }

    this.createMutationsForMatchingArgs(
      ctx,
      args,
      methodReturnType.apexType,
      enclosingMethod
    )
  }

  enterDotExpression(ctx: DotExpressionContext): void {
    if (!this.typeRegistry) {
      return
    }

    const info = resolveDotMethodCall(ctx, this.typeRegistry)
    if (!info) {
      return
    }

    const args = extractArguments(info.dotMethodCall)
    if (args.length === 0) {
      return
    }

    this.createMutationsForMatchingArgs(
      ctx,
      args,
      info.returnType.apexType,
      info.enclosingMethod
    )
  }

  private createMutationsForMatchingArgs(
    ctx: ParserRuleContext,
    args: ParserRuleContext[],
    returnType: ApexType,
    enclosingMethod: string
  ): void {
    for (const arg of args) {
      const argType = this.typeRegistry
        ? resolveExpressionApexType(
            arg.text,
            enclosingMethod,
            this.typeRegistry
          )
        : null
      if (argType === returnType) {
        this.createMutationFromParserRuleContext(ctx, arg.text)
      }
    }
  }
}
