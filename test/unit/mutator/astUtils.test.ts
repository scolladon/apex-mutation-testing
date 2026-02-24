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
import { APEX_TYPE, type ApexMethod } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

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
      TestUtil.setParent(innerCtx, methodCtx)

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
      TestUtil.setParent(middleCtx, methodCtx)
      const innerCtx = new ParserRuleContext()
      TestUtil.setParent(innerCtx, middleCtx)

      // Act
      const result = getEnclosingMethodName(innerCtx)

      // Assert
      expect(result).toBe('deepMethod')
    })

    it('Given a context with no MethodDeclarationContext ancestor, When called, Then returns null', () => {
      // Arrange
      const rootCtx = new ParserRuleContext()
      const innerCtx = new ParserRuleContext()
      TestUtil.setParent(innerCtx, rootCtx)

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
      TestUtil.setParent(innerCtx, methodCtx)

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
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const dotMethodCall = TestUtil.createDotMethodCallCtx('transform')

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
      TestUtil.setParent(ctx as ParserRuleContext, methodCtx)

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
      const typeRegistry = TestUtil.createTypeRegistry()
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
      const typeRegistry = TestUtil.createTypeRegistry()
      const ctx = { children: null } as unknown as ParserRuleContext

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a dot expression where last child is not DotMethodCallContext, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
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
      const typeRegistry = TestUtil.createTypeRegistry()
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
      const typeRegistry = TestUtil.createTypeRegistry()
      const dotMethodCall = TestUtil.createDotMethodCallCtx('transform')
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
      const typeRegistry = TestUtil.createTypeRegistry()
      const dotMethodCall = TestUtil.createDotMethodCallCtx('unknownMethod')
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
      TestUtil.setParent(ctx as ParserRuleContext, methodCtx)

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('extractArguments', () => {
    it('Given a method call with arguments, When called, Then returns argument nodes', () => {
      // Arrange
      const arg1 = TestUtil.createArgNode('x')
      const arg2 = TestUtil.createArgNode('y')
      const methodCallCtx = TestUtil.createDotMethodCallCtx('method', [
        arg1,
        arg2,
      ])

      // Act
      const result = extractArguments(methodCallCtx)

      // Assert
      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('x')
      expect(result[1].text).toBe('y')
    })

    it('Given a method call with no arguments, When called, Then returns empty array', () => {
      // Arrange
      const methodCallCtx = TestUtil.createDotMethodCallCtx('method')

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
    it('Given an integer literal, When called, Then returns INTEGER', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType('42', 'testMethod', typeRegistry)

      // Assert
      expect(result).toBe(APEX_TYPE.INTEGER)
    })

    it('Given a long literal with uppercase suffix, When called, Then returns LONG', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType('5L', 'testMethod', typeRegistry)

      // Assert
      expect(result).toBe(APEX_TYPE.LONG)
    })

    it('Given a long literal with lowercase suffix, When called, Then returns LONG', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType('5l', 'testMethod', typeRegistry)

      // Assert
      expect(result).toBe(APEX_TYPE.LONG)
    })

    it('Given a decimal numeric literal, When called, Then returns DOUBLE', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const sut = resolveExpressionApexType('3.14', 'testMethod', typeRegistry)

      // Assert
      expect(sut).toBe(APEX_TYPE.DOUBLE)
    })

    it('Given a numeric literal with trailing zero decimal, When called, Then returns DOUBLE', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const sut = resolveExpressionApexType('5.0', 'testMethod', typeRegistry)

      // Assert
      expect(sut).toBe(APEX_TYPE.DOUBLE)
    })

    it('Given a string literal, When called, Then returns STRING', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

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
      const typeRegistry = TestUtil.createTypeRegistry()

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
      const typeRegistry = TestUtil.createTypeRegistry()

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
      const typeRegistry = TestUtil.createTypeRegistry()

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
      const typeRegistry = TestUtil.createTypeRegistry(
        new Map(),
        variableScopes
      )

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
      const typeRegistry = TestUtil.createTypeRegistry()

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
