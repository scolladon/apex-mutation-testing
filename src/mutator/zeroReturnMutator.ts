import { ParserRuleContext } from 'antlr4ts'
import { ApexType } from '../type/ApexMethod.js'
import { ReturnTypeAwareBaseListener } from './returnTypeAwareBaseListener.js'

export class ZeroReturnMutator extends ReturnTypeAwareBaseListener {
  // Numeric types that should return 0
  private readonly NUMERIC_TYPES = new Set([
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
    if (!typeInfo) {
      return
    }

    if (!this.NUMERIC_TYPES.has(typeInfo.type)) {
      return
    }

    if (!ctx.children || ctx.children.length < 2) {
      return
    }

    const expressionNode = ctx.children[1]
    if (!(expressionNode instanceof ParserRuleContext)) {
      return
    }

    // Skip if already returning 0
    if (expressionNode.text.trim() === '0') {
      return
    }

    this.createMutationFromParserRuleContext(expressionNode, '0')
  }
}
