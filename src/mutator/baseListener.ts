import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ApexParserListener } from 'apex-parser'
import { SObjectDescribeRepository } from '../adapter/sObjectDescribeRepository.js'
import { ApexMutation } from '../type/ApexMutation.js'

// @ts-ignore: Base type with just a common _mutations property
export class BaseListener implements ApexParserListener {
  _mutations: ApexMutation[] = []
  _sObjectDescribeRepository?: SObjectDescribeRepository

  setSObjectDescribeRepository(repository: SObjectDescribeRepository): void {
    this._sObjectDescribeRepository = repository
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
