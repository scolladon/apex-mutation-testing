import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ApexMethod, ApexType } from '../type/ApexMethod.js'
import { TypeAwareBaseListener } from './typeAwareBaseListener.js'

export class EmptyReturnMutator extends TypeAwareBaseListener {
  private currentMethodName: string | null = null

  enterMethodDeclaration(ctx: ParserRuleContext): void {
    if (ctx.children && ctx.children.length >= 4) {
      this.currentMethodName = ctx.children[1].text
    }
  }

  exitMethodDeclaration(): void {
    this.currentMethodName = null
  }

  enterReturnStatement(ctx: ParserRuleContext): void {
    if (
      !this.currentMethodName ||
      !this.typeTable ||
      !this.typeTable.has(this.currentMethodName)
    ) {
      return
    }

    const typeInfo = this.typeTable.get(this.currentMethodName)
    if (!typeInfo) {
      return
    }

    // Skip types that can't be replaced
    if (
      [
        ApexType.VOID,
        ApexType.BOOLEAN,
        ApexType.SOBJECT,
        ApexType.OBJECT,
        ApexType.APEX_CLASS,
        ApexType.DATE,
        ApexType.DATETIME,
        ApexType.TIME,
      ].includes(typeInfo.type)
    ) {
      return
    }

    if (!ctx.children || ctx.children.length < 2) {
      return
    }

    // Child 0: "return"
    // Child 1: The expression to return
    const expressionNode = ctx.children[1]
    if (!(expressionNode instanceof ParserRuleContext)) {
      return
    }

    if (this.isEmptyValue(typeInfo.returnType, expressionNode.text)) {
      return
    }

    const emptyValue = this.generateEmptyValue(typeInfo)
    if (!emptyValue) {
      return
    }

    if (expressionNode.start) {
      this._mutations.push({
        mutationName: 'EmptyReturn',
        token: {
          symbol: expressionNode.start,
          text: expressionNode.text,
        } as TerminalNode,
        replacement: emptyValue,
      })
    }
  }

  private generateEmptyValue(typeInfo: ApexMethod): string | null {
    switch (typeInfo.type) {
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

      case ApexType.BLOB:
        return "Blob.valueOf('')"

      case ApexType.LIST:
      case ApexType.SET:
      case ApexType.MAP:
      case ApexType.CUSTOM_OBJECT:
      case ApexType.STANDARD_ENTITY:
        return `new ${typeInfo.returnType}()`

      default:
        return null
    }
  }

  public isEmptyValue(type: string, expressionText: string): boolean {
    const lowerType = type.toLowerCase()

    const emptyValuePatterns: Record<string, (expr: string) => boolean> = {
      string: expr => expr === "''" || expr === '""',
      integer: expr => expr === '0',
      double: expr => expr === '0' || expr === '0.0' || !!expr.match(/^0\.0+$/),
      decimal: expr =>
        expr === '0' || expr === '0.0' || !!expr.match(/^0\.0+$/),
      long: expr => expr === '0' || expr === '0L',
      boolean: expr => expr === 'false' || expr === 'true',
    }

    if (lowerType.startsWith('list<') || lowerType.endsWith('[]')) {
      return (
        !!expressionText.match(/new\s+List<[^>]*>\s*\(\s*\)/i) ||
        !!expressionText.match(/new\s+[^[\]]+\[\s*\]\s*\{\s*\}/)
      )
    }

    if (lowerType.startsWith('set<')) {
      return !!expressionText.match(/new\s+Set<[^>]*>\s*\(\s*\)/i)
    }

    if (lowerType.startsWith('map<')) {
      return !!expressionText.match(/new\s+Map<[^>]*>\s*\(\s*\)/i)
    }

    if (expressionText === 'null') {
      return true
    }

    const checkPattern = emptyValuePatterns[lowerType]
    if (checkPattern) {
      return checkPattern(expressionText)
    }

    return false
  }
}
