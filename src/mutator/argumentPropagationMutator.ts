import { ParserRuleContext } from 'antlr4ts'
import {
  DotExpressionContext,
  DotMethodCallContext,
  ExpressionListContext,
  MethodCallExpressionContext,
} from 'apex-parser'
import type { ApexType } from '../type/ApexMethod.js'
import { APEX_TYPE } from '../type/ApexMethod.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
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

    const args = this.extractArguments(methodCall)
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

    const args = this.extractArguments(lastChild)
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

  private extractArguments(
    methodCallCtx: ParserRuleContext
  ): ParserRuleContext[] {
    if (!methodCallCtx.children) {
      return []
    }

    for (const child of methodCallCtx.children) {
      if (child instanceof ExpressionListContext) {
        if (!child.children) {
          return []
        }
        return child.children.filter(
          c => c instanceof ParserRuleContext
        ) as ParserRuleContext[]
      }
    }
    return []
  }

  private createMutationsForMatchingArgs(
    ctx: ParserRuleContext,
    args: ParserRuleContext[],
    returnType: ApexType,
    enclosingMethod: string
  ): void {
    for (const arg of args) {
      const argType = this.resolveArgumentType(arg.text, enclosingMethod)
      if (argType === returnType) {
        this.createMutationFromParserRuleContext(ctx, arg.text)
      }
    }
  }

  private resolveArgumentType(
    text: string,
    enclosingMethod: string
  ): ApexType | null {
    if (!this.typeRegistry) {
      return null
    }

    if (/^\d/.test(text)) return APEX_TYPE.INTEGER
    if (text.startsWith("'")) return APEX_TYPE.STRING
    const lower = text.toLowerCase()
    if (lower === 'true' || lower === 'false') return APEX_TYPE.BOOLEAN

    const resolved = this.typeRegistry.resolveType(enclosingMethod, text)
    return resolved?.apexType ?? null
  }
}
