import { ParserRuleContext, Token } from 'antlr4ts'
import { TokenRange } from '../../src/type/ApexMutation.js'

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
}
