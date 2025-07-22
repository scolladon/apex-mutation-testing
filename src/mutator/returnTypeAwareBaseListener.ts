import { ParserRuleContext } from 'antlr4ts'
import { ApexMethod } from '../type/ApexMethod.js'
import { BaseListener } from './baseListener.js'

export class ReturnTypeAwareBaseListener extends BaseListener {
  protected typeTable: Map<string, ApexMethod> = new Map()
  protected currentMethodName: string | null = null

  setTypeTable(typeTable: Map<string, ApexMethod>): void {
    this.typeTable = typeTable
  }

  enterMethodDeclaration(ctx: ParserRuleContext): void {
    if (ctx.children && ctx.children.length >= 4) {
      this.currentMethodName = ctx.children[1].text
    }
  }

  exitMethodDeclaration(): void {
    this.currentMethodName = null
  }

  protected isCurrentMethodTypeKnown(): boolean {
    return (
      this.currentMethodName !== null &&
      this.typeTable.has(this.currentMethodName)
    )
  }

  protected getCurrentMethodReturnTypeInfo(): ApexMethod | null {
    return this.typeTable.get(this.currentMethodName!) ?? null
  }
}
