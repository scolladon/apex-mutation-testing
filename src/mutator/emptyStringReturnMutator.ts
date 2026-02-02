import { ParserRuleContext } from 'antlr4ts'
import { ApexType } from '../type/ApexMethod.js'
import { ReturnTypeAwareBaseListener } from './returnTypeAwareBaseListener.js'

export class EmptyStringReturnMutator extends ReturnTypeAwareBaseListener {
  enterReturnStatement(ctx: ParserRuleContext): void {
    if (!this.isCurrentMethodTypeKnown()) {
      return
    }

    const typeInfo = this.getCurrentMethodReturnTypeInfo()
    if (!typeInfo) {
      return
    }

    if (typeInfo.type !== ApexType.STRING) {
      return
    }

    if (!ctx.children || ctx.children.length < 2) {
      return
    }

    const expressionNode = ctx.children[1]
    if (!(expressionNode instanceof ParserRuleContext)) {
      return
    }

    // Skip if already returning empty string
    if (expressionNode.text.trim() === "''") {
      return
    }

    this.createMutationFromParserRuleContext(expressionNode, "''")
  }
}
