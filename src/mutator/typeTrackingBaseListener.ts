import { ParserRuleContext } from 'antlr4ts'
import { ReturnTypeAwareBaseListener } from './returnTypeAwareBaseListener.js'

export class TypeTrackingBaseListener extends ReturnTypeAwareBaseListener {
  protected methodScopeVariables: Map<string, string> = new Map()
  protected classFields: Map<string, string> = new Map()

  override enterMethodDeclaration(ctx: ParserRuleContext): void {
    super.enterMethodDeclaration(ctx)
    this.methodScopeVariables = new Map()
  }

  enterLocalVariableDeclaration(ctx: ParserRuleContext): void {
    this.trackVariableDeclaration(ctx, this.methodScopeVariables)
  }

  enterFormalParameter(ctx: ParserRuleContext): void {
    if (ctx.children && ctx.children.length >= 2) {
      const typeName = ctx.children[ctx.children.length - 2].text
      const paramName = ctx.children[ctx.children.length - 1].text
      this.methodScopeVariables.set(paramName, typeName.toLowerCase())
    }
  }

  enterFieldDeclaration(ctx: ParserRuleContext): void {
    this.trackVariableDeclaration(ctx, this.classFields)
  }

  enterEnhancedForControl(ctx: ParserRuleContext): void {
    if (ctx.children && ctx.children.length >= 2) {
      const typeName = ctx.children[0].text
      const varName = ctx.children[1].text
      this.methodScopeVariables.set(varName, typeName.toLowerCase())
    }
  }

  protected resolveVariableType(name: string): string | undefined {
    return this.methodScopeVariables.get(name) ?? this.classFields.get(name)
  }

  protected trackVariableDeclaration(
    ctx: ParserRuleContext,
    target: Map<string, string>
  ): void {
    if (ctx.children && ctx.children.length >= 2) {
      const typeName = ctx.children[0].text
      for (let i = 1; i < ctx.children.length; i++) {
        const child = ctx.children[i]
        const childText = child.text
        if (childText !== ',' && childText !== '=') {
          const varName = childText.split('=')[0]
          target.set(varName, typeName.toLowerCase())
        }
      }
    }
  }
}
