import { ParserRuleContext } from 'antlr4ts'
import { ApexMethod, ApexType } from '../type/ApexMethod.js'
import { ReturnTypeAwareBaseListener } from './returnTypeAwareBaseListener.js'

export class EmptyReturnMutator extends ReturnTypeAwareBaseListener {
  enterReturnStatement(ctx: ParserRuleContext): void {
    if (!this.isCurrentMethodTypeKnown()) {
      return
    }

    const typeInfo = this.getCurrentMethodReturnTypeInfo()
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

    if (expressionNode.start && expressionNode.stop) {
      this._mutations.push({
        mutationName: 'EmptyReturn',
        target: {
          startToken: expressionNode.start,
          endToken: expressionNode.stop,
          text: expressionNode.text,
        },
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
