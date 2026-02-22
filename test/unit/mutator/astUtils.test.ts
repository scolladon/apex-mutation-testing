import { ParserRuleContext } from 'antlr4ts'
import {
  DotMethodCallContext,
  ExpressionListContext,
  MethodDeclarationContext,
} from 'apex-parser'
import {
  extractArguments,
  getEnclosingMethodName,
  resolveDotMethodCall,
  resolveExpressionApexType,
} from '../../../src/mutator/astUtils.js'
import type { TypeMatcher } from '../../../src/service/typeMatcher.js'
import { APEX_TYPE, type ApexMethod } from '../../../src/type/ApexMethod.js'
import { TypeRegistry } from '../../../src/type/TypeRegistry.js'

function createTypeRegistry(
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
}

function setParent(child: ParserRuleContext, parent: ParserRuleContext): void {
  Object.defineProperty(child, 'parent', {
    value: parent,
    writable: true,
    configurable: true,
  })
}

function createDotMethodCallCtx(
  methodName: string,
  args?: ParserRuleContext[]
): ParserRuleContext {
  const expressionList =
    args && args.length > 0 ? createExpressionListCtx(args) : null
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
}

function createExpressionListCtx(args: ParserRuleContext[]): ParserRuleContext {
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
}

function createArgNode(text: string): ParserRuleContext {
  const node = {
    text,
    childCount: 0,
    children: [],
  } as unknown as ParserRuleContext
  Object.setPrototypeOf(node, ParserRuleContext.prototype)
  return node
}

describe('astUtils', () => {
  describe('getEnclosingMethodName', () => {
    it('Given a context with a MethodDeclarationContext parent, When called, Then returns the method name', () => {
      // Arrange
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'String' },
        { text: 'myMethod' },
        { text: '(' },
        { text: ')' },
      ]
      const innerCtx = new ParserRuleContext()
      setParent(innerCtx, methodCtx)

      // Act
      const result = getEnclosingMethodName(innerCtx)

      // Assert
      expect(result).toBe('myMethod')
    })

    it('Given a deeply nested context, When called, Then walks up to find method name', () => {
      // Arrange
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'Integer' },
        { text: 'deepMethod' },
        { text: '(' },
        { text: ')' },
      ]
      const middleCtx = new ParserRuleContext()
      setParent(middleCtx, methodCtx)
      const innerCtx = new ParserRuleContext()
      setParent(innerCtx, middleCtx)

      // Act
      const result = getEnclosingMethodName(innerCtx)

      // Assert
      expect(result).toBe('deepMethod')
    })

    it('Given a context with no MethodDeclarationContext ancestor, When called, Then returns null', () => {
      // Arrange
      const rootCtx = new ParserRuleContext()
      const innerCtx = new ParserRuleContext()
      setParent(innerCtx, rootCtx)

      // Act
      const result = getEnclosingMethodName(innerCtx)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a context with no parent, When called, Then returns null', () => {
      // Arrange
      const ctx = new ParserRuleContext()

      // Act
      const result = getEnclosingMethodName(ctx)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a MethodDeclarationContext with no children, When called, Then returns null', () => {
      // Arrange
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = undefined
      const innerCtx = new ParserRuleContext()
      setParent(innerCtx, methodCtx)

      // Act
      const result = getEnclosingMethodName(innerCtx)

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('resolveDotMethodCall', () => {
    it('Given a valid dot expression with known method, When called, Then returns DotMethodCallInfo', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const dotMethodCall = createDotMethodCallCtx('transform')

      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
      } as unknown as ParserRuleContext

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      setParent(ctx as ParserRuleContext, methodCtx)

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).not.toBeNull()
      expect(result!.methodName).toBe('transform')
      expect(result!.enclosingMethod).toBe('testMethod')
      expect(result!.returnType.apexType).toBe(APEX_TYPE.STRING)
    })

    it('Given a context with fewer than 3 children, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const ctx = {
        children: [{ text: 'obj' }],
      } as unknown as ParserRuleContext

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a context with null children, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const ctx = { children: null } as unknown as ParserRuleContext

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a dot expression where last child is not DotMethodCallContext, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, { text: 'field' }],
      } as unknown as ParserRuleContext

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a DotMethodCallContext with insufficient children, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const dotMethodCall = Object.create(DotMethodCallContext.prototype)
      Object.defineProperty(dotMethodCall, 'children', {
        value: [{ text: 'method' }],
        writable: true,
        configurable: true,
      })
      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
      } as unknown as ParserRuleContext

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })

    it('Given no enclosing method, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const dotMethodCall = createDotMethodCallCtx('transform')
      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
      } as unknown as ParserRuleContext

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a method not in typeTable, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const dotMethodCall = createDotMethodCallCtx('unknownMethod')
      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
      } as unknown as ParserRuleContext

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      setParent(ctx as ParserRuleContext, methodCtx)

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('extractArguments', () => {
    it('Given a method call with arguments, When called, Then returns argument nodes', () => {
      // Arrange
      const arg1 = createArgNode('x')
      const arg2 = createArgNode('y')
      const methodCallCtx = createDotMethodCallCtx('method', [arg1, arg2])

      // Act
      const result = extractArguments(methodCallCtx)

      // Assert
      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('x')
      expect(result[1].text).toBe('y')
    })

    it('Given a method call with no arguments, When called, Then returns empty array', () => {
      // Arrange
      const methodCallCtx = createDotMethodCallCtx('method')

      // Act
      const result = extractArguments(methodCallCtx)

      // Assert
      expect(result).toHaveLength(0)
    })

    it('Given a method call with null children, When called, Then returns empty array', () => {
      // Arrange
      const ctx = { children: null } as unknown as ParserRuleContext

      // Act
      const result = extractArguments(ctx)

      // Assert
      expect(result).toHaveLength(0)
    })

    it('Given an ExpressionListContext with null children, When called, Then returns empty array', () => {
      // Arrange
      const expressionList = Object.create(ExpressionListContext.prototype)
      Object.defineProperty(expressionList, 'children', {
        value: null,
        writable: true,
        configurable: true,
      })
      const ctx = {
        children: [
          { text: 'method' },
          { text: '(' },
          expressionList,
          { text: ')' },
        ],
      } as unknown as ParserRuleContext

      // Act
      const result = extractArguments(ctx)

      // Assert
      expect(result).toHaveLength(0)
    })
  })

  describe('resolveExpressionApexType', () => {
    it('Given a numeric literal, When called, Then returns INTEGER', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()

      // Act
      const result = resolveExpressionApexType('42', 'testMethod', typeRegistry)

      // Assert
      expect(result).toBe(APEX_TYPE.INTEGER)
    })

    it('Given a string literal, When called, Then returns STRING', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        "'hello'",
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBe(APEX_TYPE.STRING)
    })

    it('Given true, When called, Then returns BOOLEAN', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        'true',
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBe(APEX_TYPE.BOOLEAN)
    })

    it('Given false, When called, Then returns BOOLEAN', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        'false',
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBe(APEX_TYPE.BOOLEAN)
    })

    it('Given FALSE (case insensitive), When called, Then returns BOOLEAN', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        'FALSE',
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBe(APEX_TYPE.BOOLEAN)
    })

    it('Given a variable known to typeRegistry, When called, Then returns its type', () => {
      // Arrange
      const variableScopes = new Map([
        ['testMethod', new Map([['input', 'string']])],
      ])
      const typeRegistry = createTypeRegistry(new Map(), variableScopes)

      // Act
      const result = resolveExpressionApexType(
        'input',
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBe(APEX_TYPE.STRING)
    })

    it('Given an unknown variable, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        'unknown',
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBeNull()
    })
  })
})
