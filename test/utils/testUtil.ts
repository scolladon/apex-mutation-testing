import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import {
  DotMethodCallContext,
  ExpressionListContext,
  MethodDeclarationContext,
} from 'apex-parser'
import type { TypeMatcher } from '../../src/service/typeMatcher.js'
import type { ApexMethod } from '../../src/type/ApexMethod.js'
import { TokenRange } from '../../src/type/ApexMutation.js'
import { TypeRegistry } from '../../src/type/TypeRegistry.js'

export const TestUtil = {
  createToken(line: number = 1, column: number = 0): Token {
    return {
      line,
      charPositionInLine: column,
      tokenIndex: 0,
      text: '',
      type: 0,
      channel: 0,
      startIndex: 0,
      stopIndex: 0,
      inputStream: null,
    } as unknown as Token
  },

  createTokenRange(
    text: string,
    line: number = 1,
    column: number = 0
  ): TokenRange {
    return {
      startToken: this.createToken(line, column),
      endToken: this.createToken(line, column + text.length),
      text,
    }
  },

  createExpressionNode(expression: string): ParserRuleContext {
    const node = {
      text: expression,
      start: this.createToken(1, 7), // After "return "
      stop: this.createToken(1, 7 + expression.length),
      childCount: 0,
      parent: null,
      children: [],
      getChild: (_i: number) => null,
      accept: (_visitor: unknown) => null,
    } as unknown as ParserRuleContext

    Object.setPrototypeOf(node, ParserRuleContext.prototype)

    return node
  },

  createReturnStatement(expression: string): ParserRuleContext {
    const expressionNode = this.createExpressionNode(expression)

    return {
      children: [{ text: 'return' }, expressionNode],
      childCount: 2,
      getChild: (i: number) => (i === 0 ? { text: 'return' } : expressionNode),
    } as unknown as ParserRuleContext
  },

  returnWithExpression(expression: string): ParserRuleContext {
    const expressionNode = this.createExpressionNode(expression)

    return {
      children: [{ text: 'return' }, expressionNode],
      childCount: 2,
      getChild: (i: number) => (i === 0 ? { text: 'return' } : expressionNode),
    } as unknown as ParserRuleContext
  },

  createMethodDeclaration(
    returnType: string,
    methodName: string
  ): ParserRuleContext {
    return {
      children: [
        { text: returnType },
        { text: methodName },
        { text: '(' },
        { text: ')' },
      ],
      childCount: 4,
      getChild: (i: number) => ({
        text: i === 0 ? returnType : i === 1 ? methodName : i === 2 ? '(' : ')',
      }),
    } as unknown as ParserRuleContext
  },

  createPreOpExpression(
    operator: string,
    innerExpression: string
  ): ParserRuleContext {
    const { TerminalNode } = require('antlr4ts/tree')

    const operatorNode = {
      text: operator,
      [Symbol.toStringTag]: 'TerminalNode',
    }
    Object.setPrototypeOf(operatorNode, TerminalNode.prototype)

    const innerNode = this.createExpressionNode(innerExpression)

    const node = {
      text: `${operator}${innerExpression}`,
      start: this.createToken(1, 7),
      stop: this.createToken(1, 7 + operator.length + innerExpression.length),
      childCount: 2,
      parent: null,
      children: [operatorNode, innerNode],
      getChild: (i: number) => (i === 0 ? operatorNode : innerNode),
      accept: (_visitor: unknown) => null,
      ruleIndex: -1,
    } as unknown as ParserRuleContext

    Object.setPrototypeOf(node, ParserRuleContext.prototype)

    return node
  },

  createReturnStatementWithPreOp(
    operator: string,
    innerExpression: string
  ): ParserRuleContext {
    const preOpNode = this.createPreOpExpression(operator, innerExpression)

    return {
      children: [{ text: 'return' }, preOpNode],
      childCount: 2,
      getChild: (i: number) => (i === 0 ? { text: 'return' } : preOpNode),
    } as unknown as ParserRuleContext
  },

  createComplexExpression(
    expression: string,
    childCount: number
  ): ParserRuleContext {
    const node = {
      text: expression,
      start: this.createToken(1, 7),
      stop: this.createToken(1, 7 + expression.length),
      childCount,
      parent: null,
      children: Array(childCount).fill({ text: 'child' }),
      getChild: (_i: number) => ({ text: 'child' }),
      accept: (_visitor: unknown) => null,
    } as unknown as ParserRuleContext

    Object.setPrototypeOf(node, ParserRuleContext.prototype)

    return node
  },

  createReturnStatementWithComplexExpression(
    expression: string,
    childCount: number
  ): ParserRuleContext {
    const expressionNode = this.createComplexExpression(expression, childCount)

    return {
      children: [{ text: 'return' }, expressionNode],
      childCount: 2,
      getChild: (i: number) => (i === 0 ? { text: 'return' } : expressionNode),
    } as unknown as ParserRuleContext
  },

  createLocalVariableDeclaration(
    type: string,
    varName: string
  ): ParserRuleContext {
    return {
      children: [{ text: type }, { text: varName }],
      childCount: 2,
      start: this.createToken(1, 0),
    } as unknown as ParserRuleContext
  },

  createFormalParameter(type: string, paramName: string): ParserRuleContext {
    return {
      children: [{ text: type }, { text: paramName }],
      childCount: 2,
      start: this.createToken(1, 0),
    } as unknown as ParserRuleContext
  },

  createFieldDeclaration(type: string, fieldName: string): ParserRuleContext {
    return {
      children: [{ text: type }, { text: fieldName }],
      childCount: 2,
      start: this.createToken(1, 0),
    } as unknown as ParserRuleContext
  },

  createEnhancedForControl(type: string, varName: string): ParserRuleContext {
    return {
      children: [{ text: type }, { text: varName }],
      childCount: 2,
      start: this.createToken(1, 0),
    } as unknown as ParserRuleContext
  },

  createArithmeticExpression(
    left: string,
    operator: string,
    right: string
  ): ParserRuleContext {
    const operatorNode = new TerminalNode({ text: operator } as Token)
    const leftNode = { text: left }
    const rightNode = { text: right }

    return {
      childCount: 3,
      children: [leftNode, operatorNode, rightNode],
      getChild: (index: number) => {
        if (index === 0) return leftNode
        if (index === 1) return operatorNode
        return rightNode
      },
    } as unknown as ParserRuleContext
  },

  createTypeRegistry(
    methodTypeTable: Map<string, ApexMethod> = new Map(),
    variableScopes: Map<string, Map<string, string>> = new Map(),
    classFields: Map<string, string> = new Map(),
    matchers: TypeMatcher[] = []
  ): TypeRegistry {
    return new TypeRegistry(
      methodTypeTable,
      variableScopes,
      classFields,
      matchers
    )
  },

  createArgNode(text: string): ParserRuleContext {
    const node = {
      text,
      childCount: 0,
      children: [],
    } as unknown as ParserRuleContext
    Object.setPrototypeOf(node, ParserRuleContext.prototype)
    return node
  },

  createExpressionListCtx(args: ParserRuleContext[]): ParserRuleContext {
    const commaInterleaved: unknown[] = []
    args.forEach((arg, i) => {
      commaInterleaved.push(arg)
      if (i < args.length - 1) {
        commaInterleaved.push({ text: ',' })
      }
    })

    const node = Object.create(ExpressionListContext.prototype)
    Object.defineProperty(node, 'children', {
      value: commaInterleaved,
      writable: true,
      configurable: true,
    })
    return node as ParserRuleContext
  },

  createDotMethodCallCtx(
    methodName: string,
    args?: ParserRuleContext[]
  ): ParserRuleContext {
    const expressionList =
      args && args.length > 0 ? this.createExpressionListCtx(args) : null
    const children: unknown[] = [
      { text: methodName },
      { text: '(' },
      ...(expressionList ? [expressionList] : []),
      { text: ')' },
    ]

    const node = Object.create(DotMethodCallContext.prototype)
    Object.defineProperty(node, 'children', {
      value: children,
      writable: true,
      configurable: true,
    })
    return node as ParserRuleContext
  },

  createDotExpressionInMethod(
    receiverText: string,
    methodName: string,
    enclosingMethodName: string,
    args?: ParserRuleContext[]
  ): ParserRuleContext {
    const dotMethodCall = this.createDotMethodCallCtx(methodName, args)

    const ctx = {
      children: [{ text: receiverText }, { text: '.' }, dotMethodCall],
      childCount: 3,
      text: `${receiverText}.${methodName}(${args ? args.map(a => a.text).join(',') : ''})`,
      start: this.createToken(1, 0),
      stop: this.createToken(1, 30),
    } as unknown as ParserRuleContext

    const methodCtx = Object.create(MethodDeclarationContext.prototype)
    methodCtx.children = [
      { text: 'void' },
      { text: enclosingMethodName },
      { text: '(' },
      { text: ')' },
    ]
    Object.defineProperty(ctx, 'parent', {
      value: methodCtx,
      writable: true,
      configurable: true,
    })
    return ctx
  },

  createMethodCallExpressionInMethod(
    methodName: string,
    args: ParserRuleContext[],
    enclosingMethodName: string
  ): ParserRuleContext {
    const expressionList =
      args.length > 0 ? this.createExpressionListCtx(args) : null
    const methodCallChildren: unknown[] = [
      { text: methodName },
      { text: '(' },
      ...(expressionList ? [expressionList] : []),
      { text: ')' },
    ]
    const methodCall = {
      children: methodCallChildren,
      childCount: methodCallChildren.length,
    } as unknown as ParserRuleContext
    Object.setPrototypeOf(methodCall, ParserRuleContext.prototype)

    const ctx = {
      childCount: 1,
      text: `${methodName}(${args.map(a => a.text).join(',')})`,
      start: this.createToken(1, 0),
      stop: this.createToken(1, 20),
      getChild: (index: number) => (index === 0 ? methodCall : null),
    } as unknown as ParserRuleContext

    const methodCtx = Object.create(MethodDeclarationContext.prototype)
    methodCtx.children = [
      { text: 'void' },
      { text: enclosingMethodName },
      { text: '(' },
      { text: ')' },
    ]
    Object.defineProperty(ctx, 'parent', {
      value: methodCtx,
      writable: true,
      configurable: true,
    })
    return ctx
  },

  setParent(child: ParserRuleContext, parent: ParserRuleContext): void {
    Object.defineProperty(child, 'parent', {
      value: parent,
      writable: true,
      configurable: true,
    })
  },
}
