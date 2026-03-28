import { ParserRuleContext } from 'antlr4ts'
import { BaseListener } from './baseListener.js'

export class MemberVariableMutator extends BaseListener {
  enterFieldDeclaration(ctx: ParserRuleContext): void {
    if (!ctx.children) {
      return
    }

    for (const child of ctx.children) {
      if (!(child instanceof ParserRuleContext)) {
        continue
      }
      this.processVariableDeclarators(child)
    }
  }

  private processVariableDeclarators(declarators: ParserRuleContext): void {
    if (!declarators.children) {
      return
    }

    for (const declarator of declarators.children) {
      if (!(declarator instanceof ParserRuleContext)) {
        continue
      }
      this.processVariableDeclarator(declarator)
    }
  }

  private processVariableDeclarator(declarator: ParserRuleContext): void {
    if (!declarator.children || declarator.children.length < 3) {
      return
    }

    const assignIdx = declarator.children.findIndex(c => c.text === '=')
    if (assignIdx === -1) {
      return
    }

    const initValue = declarator.children[assignIdx + 1]?.text
    if (initValue?.toLowerCase() === 'null') {
      return
    }

    const varName = declarator.children[0].text
    this.createMutationFromParserRuleContext(declarator, varName)
  }
}
