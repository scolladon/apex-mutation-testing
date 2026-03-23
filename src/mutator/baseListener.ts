import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ApexParserListener } from 'apex-parser'
import type { ApexType } from '../type/ApexMethod.js'
import { APEX_TYPE } from '../type/ApexMethod.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import { getEnclosingMethodName } from './astUtils.js'

// @ts-ignore: Base type with just a common _mutations property
export class BaseListener implements ApexParserListener {
  static readonly NUMERIC_TYPES: ReadonlySet<ApexType> = new Set([
    APEX_TYPE.INTEGER,
    APEX_TYPE.LONG,
    APEX_TYPE.DOUBLE,
    APEX_TYPE.DECIMAL,
  ])

  _mutations: ApexMutation[] = []
  _coveredLines?: Set<number>

  setCoveredLines(coveredLines: Set<number>): void {
    this._coveredLines = coveredLines
  }

  constructor(protected typeRegistry?: TypeRegistry) {}

  protected getEnclosingMethodName(ctx: ParserRuleContext): string | null {
    return getEnclosingMethodName(ctx)
  }

  protected isNonNumericOperand(
    text: string,
    methodName: string | null
  ): boolean {
    if (text.includes("'")) {
      return true
    }

    if (this.typeRegistry && methodName) {
      const resolved = this.typeRegistry.resolveType(methodName, text)
      if (resolved) {
        return !BaseListener.NUMERIC_TYPES.has(resolved.apexType)
      }
      return false
    }

    return false
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
