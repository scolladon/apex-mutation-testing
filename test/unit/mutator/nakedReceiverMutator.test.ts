import { ParserRuleContext } from 'antlr4ts'
import { DotMethodCallContext, MethodDeclarationContext } from 'apex-parser'
import { NakedReceiverMutator } from '../../../src/mutator/nakedReceiverMutator.js'
import type { TypeMatcher } from '../../../src/service/typeMatcher.js'
import { APEX_TYPE, ApexMethod } from '../../../src/type/ApexMethod.js'
import { TypeRegistry } from '../../../src/type/TypeRegistry.js'
import { TestUtil } from '../../utils/testUtil.js'

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

function createDotMethodCallCtx(methodName: string): ParserRuleContext {
  const node = Object.create(DotMethodCallContext.prototype)
  Object.defineProperty(node, 'children', {
    value: [{ text: methodName }, { text: '(' }, { text: ')' }],
    writable: true,
    configurable: true,
  })
  return node as ParserRuleContext
}

function createDotExpressionInMethod(
  receiverText: string,
  methodName: string,
  enclosingMethodName: string
): ParserRuleContext {
  const dotMethodCall = createDotMethodCallCtx(methodName)

  const ctx = {
    children: [{ text: receiverText }, { text: '.' }, dotMethodCall],
    childCount: 3,
    text: `${receiverText}.${methodName}()`,
    start: TestUtil.createToken(1, 0),
    stop: TestUtil.createToken(1, 20),
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
}

describe('NakedReceiverMutator', () => {
  describe('Given a dot expression where receiver type matches method return type', () => {
    it('Then should create mutation replacing expression with receiver', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('clone', {
        returnType: 'Account',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.OBJECT,
      })
      const variableScopes = new Map([
        ['testMethod', new Map([['account', 'account']])],
      ])
      const matchers: TypeMatcher[] = [
        {
          matches: () => true,
          collect: () => {
            // no-op for test mock
          },
          collectedTypes: new Set(),
        },
      ]
      const typeRegistry = createTypeRegistry(
        typeTable,
        variableScopes,
        new Map(),
        matchers
      )
      const sut = new NakedReceiverMutator(typeRegistry)
      const ctx = createDotExpressionInMethod('account', 'clone', 'testMethod')

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('account')
      expect(sut._mutations[0].mutationName).toBe('NakedReceiverMutator')
    })
  })

  describe('Given a dot expression where receiver type is String and method returns String', () => {
    it('Then should create mutation', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('toUpperCase', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const variableScopes = new Map([
        ['testMethod', new Map([['s', 'string']])],
      ])
      const typeRegistry = createTypeRegistry(typeTable, variableScopes)
      const sut = new NakedReceiverMutator(typeRegistry)
      const ctx = createDotExpressionInMethod('s', 'toUpperCase', 'testMethod')

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('s')
    })
  })

  describe('Given a dot expression where types do not match', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('toString', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const variableScopes = new Map([
        ['testMethod', new Map([['num', 'integer']])],
      ])
      const typeRegistry = createTypeRegistry(typeTable, variableScopes)
      const sut = new NakedReceiverMutator(typeRegistry)
      const ctx = createDotExpressionInMethod('num', 'toString', 'testMethod')

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression that is a field access (not method call)', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new NakedReceiverMutator(typeRegistry)
      const ctx = {
        children: [{ text: 'account' }, { text: '.' }, { text: 'Name' }],
        childCount: 3,
      } as unknown as ParserRuleContext

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression with method not in typeTable', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const variableScopes = new Map([
        ['testMethod', new Map([['account', 'account']])],
      ])
      const typeRegistry = createTypeRegistry(new Map(), variableScopes)
      const sut = new NakedReceiverMutator(typeRegistry)
      const ctx = createDotExpressionInMethod(
        'account',
        'unknownMethod',
        'testMethod'
      )

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression with insufficient children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new NakedReceiverMutator(typeRegistry)
      const ctx = {
        children: [{ text: 'account' }],
        childCount: 1,
      } as unknown as ParserRuleContext

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression with null children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new NakedReceiverMutator(typeRegistry)
      const ctx = { children: null } as unknown as ParserRuleContext

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dotMethodCall with insufficient children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new NakedReceiverMutator(typeRegistry)

      const dotMethodCall = Object.create(DotMethodCallContext.prototype)
      Object.defineProperty(dotMethodCall, 'children', {
        value: [{ text: 'clone' }],
        writable: true,
        configurable: true,
      })

      const ctx = {
        children: [{ text: 'account' }, { text: '.' }, dotMethodCall],
        childCount: 3,
      } as unknown as ParserRuleContext

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given class field variable with matching type', () => {
    it('Then should create mutation', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('deepClone', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const classFields = new Map([['builder', 'string']])
      const typeRegistry = createTypeRegistry(typeTable, new Map(), classFields)
      const sut = new NakedReceiverMutator(typeRegistry)
      const ctx = createDotExpressionInMethod(
        'builder',
        'deepClone',
        'testMethod'
      )

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('builder')
    })
  })

  describe('Given formal parameter with matching type', () => {
    it('Then should create mutation', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('copy', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const variableScopes = new Map([
        ['testMethod', new Map([['num', 'integer']])],
      ])
      const typeRegistry = createTypeRegistry(typeTable, variableScopes)
      const sut = new NakedReceiverMutator(typeRegistry)
      const ctx = createDotExpressionInMethod('num', 'copy', 'testMethod')

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('num')
    })
  })

  describe('Given scope isolation between methods', () => {
    it('Then variable in method A should not affect method B', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('clone', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const variableScopes = new Map([
        ['methodA', new Map([['data', 'string']])],
      ])
      const typeRegistry = createTypeRegistry(typeTable, variableScopes)
      const sut = new NakedReceiverMutator(typeRegistry)
      const ctx = createDotExpressionInMethod('data', 'clone', 'methodB')

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given enhanced for control variable with matching type', () => {
    it('Then should create mutation', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('copy', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const variableScopes = new Map([
        ['testMethod', new Map([['item', 'string']])],
      ])
      const typeRegistry = createTypeRegistry(typeTable, variableScopes)
      const sut = new NakedReceiverMutator(typeRegistry)
      const ctx = createDotExpressionInMethod('item', 'copy', 'testMethod')

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('item')
    })
  })

  describe('Given receiver with unknown type', () => {
    it('Then should not create mutation when receiver cannot be resolved', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'CustomClass',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.OBJECT,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NakedReceiverMutator(typeRegistry)
      const ctx = createDotExpressionInMethod(
        'unknownVar',
        'transform',
        'testMethod'
      )

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given no TypeRegistry', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const sut = new NakedReceiverMutator()
      const ctx = createDotExpressionInMethod('account', 'clone', 'testMethod')

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })
})
