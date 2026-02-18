import { ParserRuleContext } from 'antlr4ts'
import { ApexType } from '../type/ApexMethod.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { ReturnTypeAwareBaseListener } from './returnTypeAwareBaseListener.js'

interface TypeInfo {
  apexType: ApexType
  typeName: string
}

const SKIP_TYPES: ReadonlySet<ApexType> = new Set([
  ApexType.VOID,
  ApexType.BOOLEAN,
  ApexType.SOBJECT,
  ApexType.OBJECT,
  ApexType.APEX_CLASS,
  ApexType.DATE,
  ApexType.DATETIME,
  ApexType.TIME,
])

export class EmptyReturnMutator extends ReturnTypeAwareBaseListener {
  constructor(typeRegistry?: TypeRegistry) {
    super(typeRegistry)
  }

  enterReturnStatement(ctx: ParserRuleContext): void {
    const typeInfo = this.getTypeInfoForMutation(ctx)
    if (!typeInfo) {
      return
    }

    if (SKIP_TYPES.has(typeInfo.apexType)) {
      return
    }

    if (!ctx.children || ctx.children.length < 2) {
      return
    }

    const expressionNode = ctx.children[1]
    if (!(expressionNode instanceof ParserRuleContext)) {
      return
    }

    if (this.isEmptyValue(typeInfo.typeName, expressionNode.text)) {
      return
    }

    const emptyValue = this.generateEmptyValue(typeInfo)
    if (emptyValue) {
      this.createMutationFromParserRuleContext(expressionNode, emptyValue)
    }
  }

  private getTypeInfoForMutation(ctx: ParserRuleContext): TypeInfo | null {
    if (this.typeRegistry) {
      const methodName = this.getEnclosingMethodName(ctx)
      if (!methodName) {
        return null
      }
      const resolved = this.typeRegistry.resolveType(methodName)
      if (!resolved) {
        return null
      }
      return { apexType: resolved.apexType, typeName: resolved.typeName }
    }

    if (!this.isCurrentMethodTypeKnown()) {
      return null
    }
    const method = this.getCurrentMethodReturnTypeInfo()
    if (!method) {
      return null
    }
    return { apexType: method.type, typeName: method.returnType }
  }

  private generateEmptyValue(typeInfo: TypeInfo): string | null {
    switch (typeInfo.apexType) {
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
      case ApexType.SOBJECT:
        return `new ${typeInfo.typeName}()`

      default:
        return null
    }
  }

  public isEmptyValue(type: string, expressionText: string): boolean {
    const lowerType = type.toLowerCase()

    const emptyValuePatterns: Record<string, (expr: string) => boolean> = {
      string: expr => expr === "''",
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
