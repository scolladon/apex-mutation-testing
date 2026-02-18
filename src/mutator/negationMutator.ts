import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ApexType } from '../type/ApexMethod.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { BaseListener } from './baseListener.js'

export class NegationMutator extends BaseListener {
  private static readonly NUMERIC_TYPES = new Set([
    ApexType.INTEGER,
    ApexType.LONG,
    ApexType.DOUBLE,
    ApexType.DECIMAL,
  ])

  private static readonly ZERO_LITERAL = /^0+(\.0+)?[lLdD]?$/

  constructor(typeRegistry?: TypeRegistry) {
    super(typeRegistry)
  }

  enterReturnStatement(ctx: ParserRuleContext): void {
    if (!this.isNumericReturn(ctx)) {
      return
    }

    if (!ctx.children || ctx.children.length < 2) {
      return
    }

    const expressionNode = ctx.children[1]
    if (!(expressionNode instanceof ParserRuleContext)) {
      return
    }

    if (this.isNegatedExpression(expressionNode)) {
      return
    }

    const expressionText = expressionNode.text
    if (NegationMutator.ZERO_LITERAL.test(expressionText)) {
      return
    }

    const replacement = this.formatNegation(expressionText, expressionNode)

    this.createMutationFromParserRuleContext(expressionNode, replacement)
  }

  private isNumericReturn(ctx: ParserRuleContext): boolean {
    if (!this.typeRegistry) {
      return false
    }
    const methodName = this.getEnclosingMethodName(ctx)
    if (!methodName) {
      return false
    }
    const typeInfo = this.typeRegistry.resolveType(methodName)
    return !!typeInfo && NegationMutator.NUMERIC_TYPES.has(typeInfo.apexType)
  }

  private isNegatedExpression(expr: ParserRuleContext): boolean {
    if (expr.childCount !== 2) {
      return false
    }

    const firstChild = expr.getChild(0)
    if (!(firstChild instanceof TerminalNode)) {
      return false
    }

    return firstChild.text === '-'
  }

  private formatNegation(
    expressionText: string,
    expressionNode: ParserRuleContext
  ): string {
    const isComplexExpression = expressionNode.childCount > 1

    if (isComplexExpression) {
      return `-(${expressionText})`
    }

    return `-${expressionText}`
  }
}
