import { ParserRuleContext } from 'antlr4ts'
import { BaseListener } from './baseListener.js'

export class NegationMutator extends BaseListener {
  // Values that should not be negated
  private readonly EXCLUDED_VALUES = new Set(['true', 'false', 'null'])

  // Handle return statements: return x; -> return -x;
  enterReturnStatement(ctx: ParserRuleContext): void {
    // Get the expression from the return statement
    const expression = (ctx as ReturnStatementContext).expression?.()

    if (!expression) {
      return
    }

    const expressionText = expression.text

    // Skip if already negated
    if (expressionText.startsWith('-')) {
      return
    }

    // Skip non-numeric values (strings, booleans, null)
    if (this.shouldSkipExpression(expressionText)) {
      return
    }

    // Create mutation: x -> -x
    this.createMutationFromParserRuleContext(expression, `-${expressionText}`)
  }

  private shouldSkipExpression(text: string): boolean {
    // Skip excluded values (true, false, null)
    if (this.EXCLUDED_VALUES.has(text.toLowerCase())) {
      return true
    }

    // Skip string literals
    if (text.startsWith("'") || text.startsWith('"')) {
      return true
    }

    return false
  }
}

// Type helper for ReturnStatement context
interface ReturnStatementContext extends ParserRuleContext {
  expression(): ParserRuleContext | null
}
