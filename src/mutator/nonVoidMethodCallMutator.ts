import { ParserRuleContext } from 'antlr4ts'
import {
  DotExpressionContext,
  MethodCallExpressionContext,
  NewExpressionContext,
} from 'apex-parser'
import { getDefaultValueForApexType } from '../type/ApexMethod.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

export class NonVoidMethodCallMutator extends BaseListener {
  constructor(typeRegistry?: TypeRegistry) {
    super(typeRegistry)
  }

  enterLocalVariableDeclarationStatement(ctx: ParserRuleContext): void {
    if (!ctx.children || ctx.children.length < 1) {
      return
    }

    const declCtx = ctx.children[0]
    if (!(declCtx instanceof ParserRuleContext)) {
      return
    }

    if (!declCtx.children || declCtx.children.length < 2) {
      return
    }

    const typeName = declCtx.children[0].text

    const declarators = declCtx.children[1]
    if (!(declarators instanceof ParserRuleContext) || !declarators.children) {
      return
    }

    for (const declarator of declarators.children) {
      if (declarator instanceof ParserRuleContext) {
        this.processVariableDeclarator(declarator, typeName)
      }
    }
  }

  enterAssignExpression(ctx: ParserRuleContext): void {
    if (ctx.childCount !== 3) {
      return
    }

    const lhs = ctx.getChild(0)
    const rhs = ctx.getChild(2)

    if (!(rhs instanceof ParserRuleContext)) {
      return
    }

    if (!this.isMethodCall(rhs)) {
      return
    }

    if (!this.typeRegistry) {
      return
    }

    const lhsText = lhs.text
    const methodName = this.getEnclosingMethodName(ctx)
    if (!methodName) {
      return
    }

    const resolved = this.typeRegistry.resolveType(methodName, lhsText)
    if (!resolved) {
      return
    }

    const defaultValue = lhsText.includes('.')
      ? (getDefaultValueForApexType(resolved.apexType) ?? 'null')
      : this.generateDefaultValue(resolved.typeName)

    if (defaultValue !== null) {
      this.createMutationFromParserRuleContext(rhs, defaultValue)
    }
  }

  private processVariableDeclarator(
    ctx: ParserRuleContext,
    typeName: string
  ): void {
    if (!ctx.children || ctx.children.length < 3) {
      return
    }

    let initializerIndex = -1
    for (let i = 0; i < ctx.children.length; i++) {
      if (ctx.children[i].text === '=') {
        initializerIndex = i + 1
        break
      }
    }

    if (initializerIndex === -1 || initializerIndex >= ctx.children.length) {
      return
    }

    const initializer = ctx.children[initializerIndex]
    if (!(initializer instanceof ParserRuleContext)) {
      return
    }

    if (initializer instanceof NewExpressionContext) {
      return
    }

    this.mutateMethodCallExpression(initializer, typeName)
  }

  private isMethodCall(node: ParserRuleContext): boolean {
    if (
      node instanceof MethodCallExpressionContext ||
      node instanceof DotExpressionContext
    ) {
      return true
    }

    if (node.children) {
      for (const child of node.children) {
        if (
          child instanceof MethodCallExpressionContext ||
          child instanceof DotExpressionContext
        ) {
          return true
        }
      }
    }

    return false
  }

  private mutateMethodCallExpression(
    expression: ParserRuleContext,
    typeName: string
  ): void {
    if (!this.isMethodCall(expression)) {
      return
    }
    const defaultValue = this.generateDefaultValue(typeName)
    if (defaultValue !== null) {
      this.createMutationFromParserRuleContext(expression, defaultValue)
    }
  }

  private generateDefaultValue(typeName: string): string | null {
    const lowerType = typeName.toLowerCase()

    if (lowerType.startsWith('list<') || lowerType.endsWith('[]')) {
      if (lowerType.endsWith('[]')) {
        const elementType = typeName.slice(0, -2)
        return `new List<${elementType}>()`
      }
      return `new ${typeName}()`
    }

    if (lowerType.startsWith('set<')) {
      return `new ${typeName}()`
    }

    if (lowerType.startsWith('map<')) {
      return `new ${typeName}()`
    }

    const defaultValues: Record<string, string> = {
      string: "''",
      id: "''",
      integer: '0',
      int: '0',
      long: '0L',
      double: '0.0',
      decimal: '0.0',
      boolean: 'false',
      blob: "Blob.valueOf('')",
    }

    const defaultValue = defaultValues[lowerType]
    if (defaultValue !== undefined) {
      return defaultValue
    }

    return 'null'
  }
}
