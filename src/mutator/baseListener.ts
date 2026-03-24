import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ApexParserListener } from 'apex-parser'
import { ApexMutation } from '../type/ApexMutation.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { getEnclosingMethodName } from './astUtils.js'

// @ts-ignore: Base type with just a common _mutations property
export class BaseListener implements ApexParserListener {
  _mutations: ApexMutation[] = []
  _coveredLines?: Set<number>

  setCoveredLines(coveredLines: Set<number>): void {
    this._coveredLines = coveredLines
  }

  constructor(protected typeRegistry?: TypeRegistry) {}

  protected getEnclosingMethodName(ctx: ParserRuleContext): string | null {
    return getEnclosingMethodName(ctx)
  }

  protected createMutation(
    startToken: Token,
    endToken: Token,
    originalText: string,
    replacement: string
  ): void {
    this._mutations.push({
      mutationName: this.constructor.name,
      target: {
        startToken,
        endToken,
        text: originalText,
      },
      replacement,
    })
  }

  protected createMutationFromParserRuleContext(
    ctx: ParserRuleContext,
    replacement: string
  ): void {
    if (ctx.start && ctx.stop) {
      this.createMutation(ctx.start, ctx.stop, ctx.text, replacement)
    }
  }

  protected createMutationFromTerminalNode(
    node: TerminalNode,
    replacement: string
  ): void {
    if (node.symbol) {
      this.createMutation(node.symbol, node.symbol, node.text, replacement)
    }
  }
}
