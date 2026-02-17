import { ParserRuleContext } from 'antlr4ts'
import {
  DotExpressionContext,
  MethodCallExpressionContext,
  NewExpressionContext,
} from 'apex-parser'
import { ApexType } from '../type/ApexMethod.js'
import { TypeTrackingBaseListener } from './typeTrackingBaseListener.js'

export class NonVoidMethodCallMutator extends TypeTrackingBaseListener {
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

    const lhsText = lhs.text
    let defaultValue: string | null

    if (lhsText.includes('.')) {
      defaultValue = this.resolveFieldAccessDefaultValue(lhsText)
    } else {
      const typeName = this.resolveVariableType(lhsText)
      if (!typeName) {
        return
      }
      defaultValue = this.generateDefaultValue(typeName)
    }

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

  private resolveFieldAccessDefaultValue(fieldAccess: string): string | null {
    const parts = fieldAccess.split('.')
    if (parts.length < 2) {
      return null
    }

    const rootVar = parts[0]
    const rootType = this.resolveVariableType(rootVar)

    if (!rootType) {
      return null
    }

    if (this._sObjectDescribeRepository?.isSObject(rootType)) {
      const fieldName = parts.slice(1).join('.')
      const fieldType = this._sObjectDescribeRepository.resolveFieldType(
        rootType,
        fieldName
      )
      if (fieldType !== undefined) {
        return this.generateDefaultValueFromApexType(fieldType)
      }
    }

    return null
  }

  private generateDefaultValueFromApexType(apexType: ApexType): string {
    switch (apexType) {
      case ApexType.STRING:
      case ApexType.ID:
        return "''"
      case ApexType.INTEGER:
        return '0'
      case ApexType.LONG:
        return '0L'
      case ApexType.DOUBLE:
      case ApexType.DECIMAL:
        return '0.0'
      case ApexType.BOOLEAN:
        return 'false'
      case ApexType.BLOB:
        return "Blob.valueOf('')"
      default:
        return 'null'
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
