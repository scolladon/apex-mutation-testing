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

    const hasAssignment = declarator.children.some(c => c.text === '=')
    if (!hasAssignment) {
      return
    }

    const varName = declarator.children[0].text
    this.createMutationFromParserRuleContext(declarator, varName)
  }
}
