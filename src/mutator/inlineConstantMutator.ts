import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import {
  FieldDeclarationContext,
  LiteralContext,
  LocalVariableDeclarationContext,
  ReturnStatementContext,
} from 'apex-parser'
import { getDefaultValueForApexType } from '../type/ApexMethod.js'
import { classifyApexType, TypeRegistry } from '../type/TypeRegistry.js'
import { getEnclosingMethodName } from './astUtils.js'
import { BaseListener } from './baseListener.js'

interface LiteralHandler {
  getReplacements(node: TerminalNode, ctx: LiteralContext): string[]
}

class BooleanLiteralHandler implements LiteralHandler {
  getReplacements(node: TerminalNode, _ctx: LiteralContext): string[] {
    return [node.text.toLowerCase() === 'true' ? 'false' : 'true']
  }
}

class IntegerLiteralHandler implements LiteralHandler {
  getReplacements(node: TerminalNode, _ctx: LiteralContext): string[] {
    const value = Number.parseInt(node.text, 10)
    const candidates = [0, 1, -1, value + 1, value - 1]
    return [...new Set(candidates)].filter(c => c !== value).map(String)
  }
}

class LongLiteralHandler implements LiteralHandler {
  getReplacements(node: TerminalNode, _ctx: LiteralContext): string[] {
    const text = node.text.replace(/[lL]$/, '')
    const value = Number.parseInt(text, 10)
    const candidates = [0, 1, -1, value + 1, value - 1]
    return [...new Set(candidates)].filter(c => c !== value).map(c => `${c}L`)
  }
}

class NumberLiteralHandler implements LiteralHandler {
  getReplacements(node: TerminalNode, _ctx: LiteralContext): string[] {
    const value = Number.parseFloat(node.text)
    const candidates = [0.0, 1.0, -1.0, value + 1.0, value - 1.0]
    return [...new Set(candidates)]
      .filter(c => c !== value)
      .map(c => {
        const str = String(c)
        return str.includes('.') ? str : `${str}.0`
      })
  }
}

class StringLiteralHandler implements LiteralHandler {
  getReplacements(node: TerminalNode, _ctx: LiteralContext): string[] {
    return node.text === "''" ? [] : ["''"]
  }
}

class NullLiteralHandler implements LiteralHandler {
  constructor(private typeRegistry?: TypeRegistry) {}

  getReplacements(_node: TerminalNode, ctx: LiteralContext): string[] {
    if (!this.typeRegistry) {
      return []
    }
    const replacement = this.resolveNullReplacement(ctx)
    return replacement ? [replacement] : []
  }

  private resolveNullReplacement(ctx: LiteralContext): string | null {
    let current: ParserRuleContext | undefined = ctx.parent as
      | ParserRuleContext
      | undefined
    while (current) {
      if (current instanceof ReturnStatementContext) {
        return this.resolveFromReturn(current)
      }
      if (
        current instanceof LocalVariableDeclarationContext ||
        current instanceof FieldDeclarationContext
      ) {
        return this.resolveFromDeclaration(current)
      }
      current = current.parent as ParserRuleContext | undefined
    }
    return null
  }

  private resolveFromReturn(ctx: ParserRuleContext): string | null {
    const methodName = getEnclosingMethodName(ctx)
    if (!methodName) {
      return null
    }
    const typeInfo = this.typeRegistry!.resolveType(methodName)
    if (!typeInfo) {
      return null
    }
    return getDefaultValueForApexType(typeInfo.apexType, typeInfo.typeName)
  }

  private resolveFromDeclaration(ctx: ParserRuleContext): string | null {
    const typeName = ctx.children?.[0]?.text
    if (!typeName) {
      return null
    }
    const apexType = classifyApexType(typeName, [])
    return getDefaultValueForApexType(apexType, typeName)
  }
}

type LiteralDetector = (ctx: LiteralContext) => TerminalNode | undefined

export class InlineConstantMutator extends BaseListener {
  private handlerFactory: Map<LiteralDetector, LiteralHandler>

  constructor(typeRegistry?: TypeRegistry) {
    super(typeRegistry)
    this.handlerFactory = new Map([
      [
        (ctx: LiteralContext) => ctx.IntegerLiteral(),
        new IntegerLiteralHandler(),
      ],
      [(ctx: LiteralContext) => ctx.LongLiteral(), new LongLiteralHandler()],
      [
        (ctx: LiteralContext) => ctx.NumberLiteral(),
        new NumberLiteralHandler(),
      ],
      [
        (ctx: LiteralContext) => ctx.StringLiteral(),
        new StringLiteralHandler(),
      ],
      [
        (ctx: LiteralContext) => ctx.BooleanLiteral(),
        new BooleanLiteralHandler(),
      ],
      [
        (ctx: LiteralContext) => ctx.NULL(),
        new NullLiteralHandler(typeRegistry),
      ],
    ])
  }

  enterLiteral(ctx: LiteralContext): void {
    for (const [detect, handler] of this.handlerFactory) {
      const node = detect(ctx)
      if (node) {
        for (const replacement of handler.getReplacements(node, ctx)) {
          this.createMutationFromTerminalNode(node, replacement)
        }
        return
      }
    }
  }
}
