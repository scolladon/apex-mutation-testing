import { TerminalNode } from 'antlr4ts/tree/index.js'
import { LiteralContext } from 'apex-parser'
import { BaseListener } from './baseListener.js'

interface LiteralHandler {
  getReplacements(node: TerminalNode): string[]
}

class BooleanLiteralHandler implements LiteralHandler {
  getReplacements(node: TerminalNode): string[] {
    return [node.text.toLowerCase() === 'true' ? 'false' : 'true']
  }
}

class IntegerLiteralHandler implements LiteralHandler {
  getReplacements(node: TerminalNode): string[] {
    const value = Number.parseInt(node.text, 10)
    const candidates = [0, 1, -1, value + 1, value - 1]
    return [...new Set(candidates)].filter(c => c !== value).map(String)
  }
}

type LiteralDetector = (ctx: LiteralContext) => TerminalNode | undefined

const HANDLER_FACTORY: Map<LiteralDetector, LiteralHandler> = new Map([
  [(ctx: LiteralContext) => ctx.IntegerLiteral(), new IntegerLiteralHandler()],
  [(ctx: LiteralContext) => ctx.BooleanLiteral(), new BooleanLiteralHandler()],
])

export class InlineConstantMutator extends BaseListener {
  enterLiteral(ctx: LiteralContext): void {
    for (const [detect, handler] of HANDLER_FACTORY) {
      const node = detect(ctx)
      if (node) {
        for (const replacement of handler.getReplacements(node)) {
          this.createMutationFromTerminalNode(node, replacement)
        }
        return
      }
    }
  }
}
