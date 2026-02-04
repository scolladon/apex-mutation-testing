import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ApexType } from '../type/ApexMethod.js'
import { ReturnTypeAwareBaseListener } from './returnTypeAwareBaseListener.js'

export class NegationMutator extends ReturnTypeAwareBaseListener {
  private static readonly NUMERIC_TYPES = new Set([
    ApexType.INTEGER,
    ApexType.LONG,
    ApexType.DOUBLE,
    ApexType.DECIMAL,
  ])

  enterReturnStatement(ctx: ParserRuleContext): void {
    if (!this.isCurrentMethodTypeKnown()) {
      return
    }

    const typeInfo = this.getCurrentMethodReturnTypeInfo()
    if (!typeInfo || !NegationMutator.NUMERIC_TYPES.has(typeInfo.type)) {
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
    const replacement = this.formatNegation(expressionText, expressionNode)

    this.createMutationFromParserRuleContext(expressionNode, replacement)
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
