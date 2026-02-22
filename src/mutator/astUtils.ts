import { ParserRuleContext } from 'antlr4ts'
import {
  DotMethodCallContext,
  ExpressionListContext,
  MethodDeclarationContext,
} from 'apex-parser'
import type { ApexType } from '../type/ApexMethod.js'
import { APEX_TYPE } from '../type/ApexMethod.js'
import type { ResolvedType, TypeRegistry } from '../type/TypeRegistry.js'

export interface DotMethodCallInfo {
  dotMethodCall: ParserRuleContext
  methodName: string
  enclosingMethod: string
  returnType: ResolvedType
}

export function getEnclosingMethodName(ctx: ParserRuleContext): string | null {
  let current: ParserRuleContext | undefined = ctx.parent as
    | ParserRuleContext
    | undefined
  while (current) {
    if (current instanceof MethodDeclarationContext) {
      return current.children?.[1]?.text ?? null
    }
    current = current.parent as ParserRuleContext | undefined
  }
  return null
}

export function resolveDotMethodCall(
  ctx: ParserRuleContext,
  typeRegistry: TypeRegistry
): DotMethodCallInfo | null {
  if (!ctx.children || ctx.children.length < 3) {
    return null
  }

  const lastChild = ctx.children[ctx.children.length - 1]
  if (!(lastChild instanceof DotMethodCallContext)) {
    return null
  }

  if (!lastChild.children || lastChild.children.length < 3) {
    return null
  }

  const methodName = lastChild.children[0].text
  const enclosingMethod = getEnclosingMethodName(ctx)
  if (!enclosingMethod) {
    return null
  }

  const returnType = typeRegistry.resolveType(
    enclosingMethod,
    `${methodName}()`
  )
  if (!returnType) {
    return null
  }

  return {
    dotMethodCall: lastChild as ParserRuleContext,
    methodName,
    enclosingMethod,
    returnType,
  }
}

export function extractArguments(
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

export function resolveExpressionApexType(
  text: string,
  enclosingMethod: string,
  typeRegistry: TypeRegistry
): ApexType | null {
  if (/^\d/.test(text)) return APEX_TYPE.INTEGER
  if (text.startsWith("'")) return APEX_TYPE.STRING
  const lower = text.toLowerCase()
  if (lower === 'true' || lower === 'false') return APEX_TYPE.BOOLEAN

  const resolved = typeRegistry.resolveType(enclosingMethod, text)
  return resolved?.apexType ?? null
}
