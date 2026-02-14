import { ParserRuleContext } from 'antlr4ts'
import { ApexType } from '../type/ApexMethod.js'
import { ReturnTypeAwareBaseListener } from './returnTypeAwareBaseListener.js'

export class NakedReceiverMutator extends ReturnTypeAwareBaseListener {
  private methodScopeVariables: Map<string, string> = new Map()
  private classFields: Map<string, string> = new Map()

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

  enterDotExpression(ctx: ParserRuleContext): void {
    if (!ctx.children || ctx.children.length < 3) {
      return
    }

    const lastChild = ctx.children[ctx.children.length - 1]
    if (!(lastChild instanceof ParserRuleContext)) {
      return
    }

    if (lastChild.constructor?.name !== 'DotMethodCallContext') {
      return
    }

    if (!lastChild.children || lastChild.children.length < 3) {
      return
    }

    const methodName = lastChild.children[0].text
    const methodInfo = this.typeTable.get(methodName)
    if (!methodInfo) {
      return
    }

    const receiver = ctx.children[0]
    const receiverText = receiver.text
    const receiverType = this.resolveReceiverType(receiverText)

    if (receiverType === methodInfo.type) {
      this.createMutationFromParserRuleContext(ctx, receiverText)
    }
  }

  private resolveReceiverType(text: string): ApexType {
    const varType =
      this.methodScopeVariables.get(text) ?? this.classFields.get(text)
    if (varType) {
      return this.resolveApexType(varType)
    }
    return ApexType.OBJECT
  }

  private resolveApexType(typeName: string): ApexType {
    const typeMap: Record<string, ApexType> = {
      integer: ApexType.INTEGER,
      long: ApexType.LONG,
      double: ApexType.DOUBLE,
      decimal: ApexType.DECIMAL,
      string: ApexType.STRING,
      boolean: ApexType.BOOLEAN,
      date: ApexType.DATE,
      datetime: ApexType.DATETIME,
      id: ApexType.ID,
    }
    return typeMap[typeName] ?? ApexType.OBJECT
  }

  private trackVariableDeclaration(
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
