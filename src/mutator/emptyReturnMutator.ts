import { ParserRuleContext } from 'antlr4ts'
import type { ApexType } from '../type/ApexMethod.js'
import { APEX_TYPE, getDefaultValueForApexType } from '../type/ApexMethod.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

interface TypeInfo {
  apexType: ApexType
  typeName: string
}

const SKIP_TYPES: ReadonlySet<ApexType> = new Set([
  APEX_TYPE.VOID,
  APEX_TYPE.BOOLEAN,
  APEX_TYPE.SOBJECT,
  APEX_TYPE.OBJECT,
  APEX_TYPE.APEX_CLASS,
  APEX_TYPE.DATE,
  APEX_TYPE.DATETIME,
  APEX_TYPE.TIME,
])

export class EmptyReturnMutator extends BaseListener {
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

    if (!ctx.children) {
      return
    }

    // No length check: `return;` yields a terminal ';' at index 1, which the
    // instanceof guard below rejects.

    const expressionNode = ctx.children[1]
    // Unreachable via the parser: a bare `return;` only occurs in a void method,
    // whose type is filtered by SKIP_TYPES above, so child 1 is always the
    // returned expression here.
    // Stryker disable next-line ConditionalExpression,BlockStatement: unreachable.
    if (!(expressionNode instanceof ParserRuleContext)) {
      return
    }

    if (this.isEmptyValue(typeInfo.typeName, expressionNode.text)) {
      return
    }

    const emptyValue = getDefaultValueForApexType(
      typeInfo.apexType,
      typeInfo.typeName
    )
    if (emptyValue) {
      this.createMutationFromParserRuleContext(expressionNode, emptyValue)
    }
  }

  private getTypeInfoForMutation(ctx: ParserRuleContext): TypeInfo | null {
    if (!this.typeRegistry) {
      return null
    }
    const methodName = this.getEnclosingMethodName(ctx)
    // Not observable: a return statement always sits inside a method, and even
    // without one `resolveType(undefined)` misses the table and the `!resolved`
    // check below returns null all the same.
    // Stryker disable next-line ConditionalExpression,BlockStatement: same result either way.
    if (!methodName) {
      return null
    }
    const resolved = this.typeRegistry.resolveType(methodName)
    if (!resolved) {
      return null
    }
    return { apexType: resolved.apexType, typeName: resolved.typeName }
  }

  public isEmptyValue(type: string, expressionText: string): boolean {
    const lowerType = type.toLowerCase()

    const emptyValuePatterns: Record<string, (expr: string) => boolean> = {
      string: expr => expr === "''",
      integer: expr => expr === '0',
      // `0.0` is already covered by the /^0\.0+$/ pattern, so it needs no
      // separate comparison.
      double: expr => expr === '0' || !!expr.match(/^0\.0+$/),
      decimal: expr => expr === '0' || !!expr.match(/^0\.0+$/),
      long: expr => expr === '0' || expr === '0L',
    }

    if (lowerType.startsWith('list<') || lowerType.endsWith('[]')) {
      return (
        !!expressionText.match(/new\s+List<[^>]*>\s*\(\s*\)/i) ||
        // Stryker disable next-line Regex: `[^[\]]+` absorbs any extra
        // whitespace, so `\s` and `\s+` accept exactly the same inputs.
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
