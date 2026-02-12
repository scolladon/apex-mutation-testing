import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ApexType } from '../type/ApexMethod.js'
import { ReturnTypeAwareBaseListener } from './returnTypeAwareBaseListener.js'

export class ArithmeticOperatorMutator extends ReturnTypeAwareBaseListener {
  private readonly REPLACEMENT_MAP: Record<string, string[]> = {
    '+': ['-', '*', '/'],
    '-': ['+', '*', '/'],
    '*': ['+', '-', '/'],
    '/': ['+', '-', '*'],
  }

  private static readonly NUMERIC_TYPES = new Set([
    ApexType.INTEGER,
    ApexType.LONG,
    ApexType.DOUBLE,
    ApexType.DECIMAL,
  ])

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

  // Handle MUL, DIV, and MOD operations (*, /, %)
  enterArth1Expression(ctx: ParserRuleContext): void {
    this.processArithmeticOperation(ctx)
  }

  // Handle ADD and SUB operations (+, -)
  enterArth2Expression(ctx: ParserRuleContext): void {
    this.processArithmeticOperation(ctx)
  }

  enterAssignExpression(_ctx: ParserRuleContext): void {
    // Method intentionally left empty - enables traversal into children
  }

  private processArithmeticOperation(ctx: ParserRuleContext): void {
    if (ctx.childCount === 3) {
      const operatorNode = ctx.getChild(1)

      if (operatorNode instanceof TerminalNode) {
        const operatorText = operatorNode.text
        const replacements = this.REPLACEMENT_MAP[operatorText]

        if (replacements) {
          if (operatorText === '+' && this.isNonNumericContext(ctx)) {
            return
          }

          for (const replacement of replacements) {
            this.createMutationFromTerminalNode(operatorNode, replacement)
          }
        }
      }
    }
  }

  private isNonNumericContext(ctx: ParserRuleContext): boolean {
    const leftText = ctx.getChild(0).text
    const rightText = ctx.getChild(2).text

    return (
      this.isNonNumericOperand(leftText) || this.isNonNumericOperand(rightText)
    )
  }

  private isNonNumericOperand(text: string): boolean {
    if (text.startsWith("'")) {
      return true
    }

    const variableType =
      this.methodScopeVariables.get(text) ?? this.classFields.get(text)
    if (variableType !== undefined) {
      return !ArithmeticOperatorMutator.NUMERIC_TYPES.has(
        this.resolveApexType(variableType)
      )
    }

    const methodCallMatch = text.match(/^(\w+)\(/)
    if (methodCallMatch) {
      const methodName = methodCallMatch[1]
      const methodInfo = this.typeTable.get(methodName)
      if (methodInfo) {
        return !ArithmeticOperatorMutator.NUMERIC_TYPES.has(methodInfo.type)
      }
    }

    return false
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
