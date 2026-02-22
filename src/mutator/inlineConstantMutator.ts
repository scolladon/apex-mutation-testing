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

type LiteralDetector = (ctx: LiteralContext) => TerminalNode | undefined

const HANDLER_FACTORY: Map<LiteralDetector, LiteralHandler> = new Map([
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
