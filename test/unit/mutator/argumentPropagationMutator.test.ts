import { ParserRuleContext } from 'antlr4ts'
import {
  DotMethodCallContext,
  ExpressionListContext,
  MethodDeclarationContext,
} from 'apex-parser'
import { ArgumentPropagationMutator } from '../../../src/mutator/argumentPropagationMutator.js'
import type { TypeMatcher } from '../../../src/service/typeMatcher.js'
import { APEX_TYPE, type ApexMethod } from '../../../src/type/ApexMethod.js'
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

function createMethodCallContext(
  methodName: string,
  args: ParserRuleContext[]
): ParserRuleContext {
  const expressionList = args.length > 0 ? createExpressionListCtx(args) : null
  const children: unknown[] = [
    { text: methodName },
    { text: '(' },
    ...(expressionList ? [expressionList] : []),
    { text: ')' },
  ]

  const node = {
    children,
    childCount: children.length,
  } as unknown as ParserRuleContext
  Object.setPrototypeOf(node, ParserRuleContext.prototype)
  return node
}

function createMethodCallExpressionInMethod(
  methodName: string,
  args: ParserRuleContext[],
  enclosingMethodName: string
): ParserRuleContext {
  const methodCall = createMethodCallContext(methodName, args)

  const ctx = {
    childCount: 1,
    text: `${methodName}(${args.map(a => a.text).join(',')})`,
    start: TestUtil.createToken(1, 0),
    stop: TestUtil.createToken(1, 20),
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
}

function createDotMethodCallCtx(
  methodName: string,
  args: ParserRuleContext[]
): ParserRuleContext {
  const expressionList = args.length > 0 ? createExpressionListCtx(args) : null
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

function createDotExpressionInMethod(
  receiverText: string,
  methodName: string,
  args: ParserRuleContext[],
  enclosingMethodName: string
): ParserRuleContext {
  const dotMethodCall = createDotMethodCallCtx(methodName, args)

  const ctx = {
    children: [{ text: receiverText }, { text: '.' }, dotMethodCall],
    childCount: 3,
    text: `${receiverText}.${methodName}(${args.map(a => a.text).join(',')})`,
    start: TestUtil.createToken(1, 0),
    stop: TestUtil.createToken(1, 30),
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

describe('ArgumentPropagationMutator', () => {
  describe('Given a method call with matching-type argument', () => {
    it('Then should create mutation replacing call with argument', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const variableScopes = new Map([
        ['testMethod', new Map([['input', 'string']])],
      ])
      const typeRegistry = createTypeRegistry(typeTable, variableScopes)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = createArgNode('input')
      const ctx = createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('input')
      expect(sut._mutations[0].mutationName).toBe('ArgumentPropagationMutator')
    })
  })

  describe('Given a method call with non-matching-type argument', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const variableScopes = new Map([
        ['testMethod', new Map([['count', 'integer']])],
      ])
      const typeRegistry = createTypeRegistry(typeTable, variableScopes)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = createArgNode('count')
      const ctx = createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a method call with no arguments', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const ctx = createMethodCallExpressionInMethod(
        'process',
        [],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a method call with multiple args where some match', () => {
    it('Then should create mutations only for matching args', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('compute', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const variableScopes = new Map([
        [
          'testMethod',
          new Map([
            ['x', 'integer'],
            ['y', 'string'],
          ]),
        ],
      ])
      const typeRegistry = createTypeRegistry(typeTable, variableScopes)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argX = createArgNode('x')
      const argY = createArgNode('y')
      const ctx = createMethodCallExpressionInMethod(
        'compute',
        [argX, argY],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('x')
    })
  })

  describe('Given a method call not in typeTable', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const argNode = createArgNode('x')
      const ctx = createMethodCallExpressionInMethod(
        'unknownMethod',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression method call with matching arg', () => {
    it('Then should create mutation', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const variableScopes = new Map([
        ['testMethod', new Map([['input', 'string']])],
      ])
      const typeRegistry = createTypeRegistry(typeTable, variableScopes)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = createArgNode('input')
      const ctx = createDotExpressionInMethod(
        'obj',
        'transform',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('input')
    })
  })

  describe('Given a dot expression that is a field access', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const lastChild = { text: 'fieldName' }
      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, lastChild],
        childCount: 3,
      } as unknown as ParserRuleContext

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given string literal argument matching String return type', () => {
    it('Then should create mutation', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = createArgNode("'hello'")
      const ctx = createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe("'hello'")
    })
  })

  describe('Given numeric literal argument matching Integer return type', () => {
    it('Then should create mutation', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = createArgNode('42')
      const ctx = createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('42')
    })
  })

  describe('Given boolean literal argument matching Boolean return type', () => {
    it('Then should create mutation', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.BOOLEAN,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = createArgNode('true')
      const ctx = createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('true')
    })
  })

  describe('Given a method call expression with childCount !== 1', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const ctx = { childCount: 2 } as unknown as ParserRuleContext

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a method call expression where child is not ParserRuleContext', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const ctx = {
        childCount: 1,
        getChild: () => ({ text: 'notAContext' }),
      } as unknown as ParserRuleContext

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression with insufficient children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const ctx = {
        children: [{ text: 'obj' }],
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
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const ctx = { children: null } as unknown as ParserRuleContext

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given scope isolation for variable tracking', () => {
    it('Then variable in method A should not affect method B', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const variableScopes = new Map([
        ['methodA', new Map([['input', 'string']])],
      ])
      const typeRegistry = createTypeRegistry(typeTable, variableScopes)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = createArgNode('input')
      const ctx = createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'methodB'
      )

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression with DotMethodCallContext with insufficient children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const dotMethodCall = Object.create(DotMethodCallContext.prototype)
      Object.defineProperty(dotMethodCall, 'children', {
        value: [{ text: 'method' }],
        writable: true,
        configurable: true,
      })

      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
        childCount: 3,
      } as unknown as ParserRuleContext

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression method call with no matching args', () => {
    it('Then should not create any mutations when no args provided', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const ctx = createDotExpressionInMethod(
        'obj',
        'transform',
        [],
        'testMethod'
      )

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a method call child with insufficient children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const methodCall = {
        children: [{ text: 'process' }],
        childCount: 1,
      } as unknown as ParserRuleContext
      Object.setPrototypeOf(methodCall, ParserRuleContext.prototype)

      const ctx = {
        childCount: 1,
        getChild: () => methodCall,
      } as unknown as ParserRuleContext

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given method call argument resolved as method return type', () => {
    it('Then should match argument type from method call', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('outer', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      typeTable.set('inner', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = createArgNode('inner()')
      const ctx = createMethodCallExpressionInMethod(
        'outer',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('inner()')
    })
  })

  describe('Given no TypeRegistry', () => {
    it('Then should not create any mutations for enterMethodCallExpression', () => {
      // Arrange
      const sut = new ArgumentPropagationMutator()
      const argNode = createArgNode('input')
      const ctx = createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Then should not create any mutations for enterDotExpression', () => {
      // Arrange
      const sut = new ArgumentPropagationMutator()
      const argNode = createArgNode('input')
      const ctx = createDotExpressionInMethod(
        'obj',
        'transform',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression with method not in typeTable', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const argNode = createArgNode('x')
      const ctx = createDotExpressionInMethod(
        'obj',
        'unknownMethod',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })
})
