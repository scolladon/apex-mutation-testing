import { ParserRuleContext } from 'antlr4ts'
import {
  DotExpressionContext,
  DotMethodCallContext,
  MethodCallExpressionContext,
  MethodDeclarationContext,
} from 'apex-parser'
import { ArgumentPropagationMutator } from '../../../src/mutator/argumentPropagationMutator.js'
import { APEX_TYPE, type ApexMethod } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

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
      const typeRegistry = TestUtil.createTypeRegistry(
        typeTable,
        variableScopes
      )
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = TestUtil.createArgNode('input')
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

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
      const typeRegistry = TestUtil.createTypeRegistry(
        typeTable,
        variableScopes
      )
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = TestUtil.createArgNode('count')
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

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
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'process',
        [],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

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
      const typeRegistry = TestUtil.createTypeRegistry(
        typeTable,
        variableScopes
      )
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argX = TestUtil.createArgNode('x')
      const argY = TestUtil.createArgNode('y')
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'compute',
        [argX, argY],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('x')
    })
  })

  describe('Given a method call not in typeTable', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const argNode = TestUtil.createArgNode('x')
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'unknownMethod',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

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
      const typeRegistry = TestUtil.createTypeRegistry(
        typeTable,
        variableScopes
      )
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = TestUtil.createArgNode('input')
      const ctx = TestUtil.createDotExpressionInMethod(
        'obj',
        'transform',
        'testMethod',
        [argNode]
      )

      // Act
      sut.enterDotExpression(ctx as unknown as DotExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('input')
    })
  })

  describe('Given a dot expression that is a field access', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const lastChild = { text: 'fieldName' }
      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, lastChild],
        childCount: 3,
      } as unknown as ParserRuleContext

      // Act
      sut.enterDotExpression(ctx as unknown as DotExpressionContext)

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
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = TestUtil.createArgNode("'hello'")
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

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
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = TestUtil.createArgNode('42')
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

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
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = TestUtil.createArgNode('true')
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('true')
    })
  })

  describe('Given a method call expression with childCount !== 1', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const ctx = { childCount: 2 } as unknown as ParserRuleContext

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a method call expression where child is not ParserRuleContext', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const ctx = {
        childCount: 1,
        getChild: () => ({ text: 'notAContext' }),
      } as unknown as ParserRuleContext

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a method call where child is not ParserRuleContext but has valid structure', () => {
    it('Then should not create any mutations even though child passes all structure guards', () => {
      // Arrange
      // Set up typeRegistry and parent so all guards after line 23 would pass if we bypass the instanceof check
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      // Non-PRC child with children.length >= 3 and valid method name at [0]
      const argNode = TestUtil.createArgNode("'hello'")
      const expressionList = TestUtil.createExpressionListCtx([argNode])
      const nonPrcChild = {
        text: 'process',
        children: [
          { text: 'process' },
          { text: '(' },
          expressionList,
          { text: ')' },
        ],
      }

      // Build a ctx with a parent MethodDeclarationContext so enclosingMethod is found
      const ctx = {
        childCount: 1,
        text: 'process()',
        start: TestUtil.createToken(1, 0),
        stop: TestUtil.createToken(1, 9),
        getChild: () => nonPrcChild,
      } as unknown as ParserRuleContext

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      Object.defineProperty(ctx, 'parent', {
        value: methodCtx,
        writable: true,
        configurable: true,
      })

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert: guard at line 23 prevents processing even though child has valid structure
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression with insufficient children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const ctx = {
        children: [{ text: 'obj' }],
        childCount: 1,
      } as unknown as ParserRuleContext

      // Act
      sut.enterDotExpression(ctx as unknown as DotExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression with null children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const ctx = { children: null } as unknown as ParserRuleContext

      // Act
      sut.enterDotExpression(ctx as unknown as DotExpressionContext)

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
      const typeRegistry = TestUtil.createTypeRegistry(
        typeTable,
        variableScopes
      )
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = TestUtil.createArgNode('input')
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'methodB'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression with DotMethodCallContext with insufficient children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
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
      sut.enterDotExpression(ctx as unknown as DotExpressionContext)

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
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const ctx = TestUtil.createDotExpressionInMethod(
        'obj',
        'transform',
        'testMethod'
      )

      // Act
      sut.enterDotExpression(ctx as unknown as DotExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a method call child with insufficient children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
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
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

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
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = TestUtil.createArgNode('inner()')
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'outer',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('inner()')
    })
  })

  describe('Given no TypeRegistry', () => {
    it('Then should not create any mutations for enterMethodCallExpression', () => {
      // Arrange
      const sut = new ArgumentPropagationMutator()
      const argNode = TestUtil.createArgNode('input')
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Then should not create any mutations for enterDotExpression', () => {
      // Arrange
      const sut = new ArgumentPropagationMutator()
      const argNode = TestUtil.createArgNode('input')
      const ctx = TestUtil.createDotExpressionInMethod(
        'obj',
        'transform',
        'testMethod',
        [argNode]
      )

      // Act
      sut.enterDotExpression(ctx as unknown as DotExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression with method not in typeTable', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const argNode = TestUtil.createArgNode('x')
      const ctx = TestUtil.createDotExpressionInMethod(
        'obj',
        'unknownMethod',
        'testMethod',
        [argNode]
      )

      // Act
      sut.enterDotExpression(ctx as unknown as DotExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a method call where typeRegistry exists but no enclosing method', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = TestUtil.createArgNode('input')
      // Build ctx with childCount === 1, valid ParserRuleContext child with children.length >= 3,
      // but no parent MethodDeclarationContext so enclosingMethod resolves to null
      const expressionList = TestUtil.createExpressionListCtx([argNode])
      const methodCallChildren: unknown[] = [
        { text: 'process' },
        { text: '(' },
        expressionList,
        { text: ')' },
      ]
      const methodCall = {
        children: methodCallChildren,
        childCount: methodCallChildren.length,
      } as unknown as ParserRuleContext
      Object.setPrototypeOf(methodCall, ParserRuleContext.prototype)

      const ctx = {
        childCount: 1,
        text: 'process(input)',
        start: TestUtil.createToken(1, 0),
        stop: TestUtil.createToken(1, 14),
        getChild: (index: number) => (index === 0 ? methodCall : null),
        // No parent set — getEnclosingMethodName will return null
      } as unknown as ParserRuleContext

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a method call child with exactly 2 children (boundary for length < 3)', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      // Use full setup so the only guard that triggers is the length < 3 check
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      // Build methodCall with exactly 2 children including an ExpressionListContext
      // so that bypassing the length guard would actually produce mutations
      const argNode = TestUtil.createArgNode("'hello'")
      const expressionList = TestUtil.createExpressionListCtx([argNode])
      const methodCall = {
        children: [{ text: 'process' }, expressionList],
        childCount: 2,
      } as unknown as ParserRuleContext
      Object.setPrototypeOf(methodCall, ParserRuleContext.prototype)

      const ctx = {
        childCount: 1,
        text: 'process()',
        start: TestUtil.createToken(1, 0),
        stop: TestUtil.createToken(1, 9),
        getChild: () => methodCall,
      } as unknown as ParserRuleContext

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      Object.defineProperty(ctx, 'parent', {
        value: methodCtx,
        writable: true,
        configurable: true,
      })

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert: length < 3 guard rejects this context (only 2 children)
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a method call where methodCall.children is null', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const methodCall = {
        children: null,
        childCount: 0,
      } as unknown as ParserRuleContext
      Object.setPrototypeOf(methodCall, ParserRuleContext.prototype)

      const ctx = {
        childCount: 1,
        getChild: () => methodCall,
      } as unknown as ParserRuleContext

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a method call child with exactly 3 children (boundary for length >= 3 passing)', () => {
    it('Then should create a mutation when children has exactly 3 elements including an arg', () => {
      // Arrange — length=3 should PASS the < 3 guard (3 is not < 3) and produce a mutation
      // This distinguishes `< 3` from `<= 3` (which would block length=3)
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      // 3 children: methodName, expressionList, ')' — unusual but sufficient for boundary test
      const argNode = TestUtil.createArgNode("'hello'")
      const expressionList = TestUtil.createExpressionListCtx([argNode])
      const methodCall = {
        children: [{ text: 'process' }, expressionList, { text: ')' }],
        childCount: 3,
      } as unknown as ParserRuleContext
      Object.setPrototypeOf(methodCall, ParserRuleContext.prototype)

      const ctx = {
        childCount: 1,
        text: 'process()',
        start: TestUtil.createToken(1, 0),
        stop: TestUtil.createToken(1, 9),
        getChild: () => methodCall,
      } as unknown as ParserRuleContext

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      Object.defineProperty(ctx, 'parent', {
        value: methodCtx,
        writable: true,
        configurable: true,
      })

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert: 3 children passes the length < 3 guard, and the mutation is created
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe("'hello'")
    })
  })

  describe('Given a method call with childCount of 0', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const ctx = { childCount: 0 } as unknown as ParserRuleContext

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression where no enclosing method exists', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)
      const argNode = TestUtil.createArgNode('input')
      const dotMethodCall = TestUtil.createDotMethodCallCtx('transform', [
        argNode,
      ])
      // No parent set — getEnclosingMethodName will return null
      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
        childCount: 3,
        text: 'obj.transform(input)',
        start: TestUtil.createToken(1, 0),
        stop: TestUtil.createToken(1, 20),
      } as unknown as ParserRuleContext

      // Act
      sut.enterDotExpression(ctx as unknown as DotExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given boolean false literal argument matching Boolean return type', () => {
    it('Then should create mutation (kills lower === true || lower === false → && mutant)', () => {
      // Arrange — 'false' text must independently resolve to BOOLEAN.
      // With mutant `||` → `&&`: only text that is BOTH 'true' AND 'false' resolves to BOOLEAN,
      // which is impossible → 'false' alone would not match → no mutation created.
      // Original code: 'false'.toLowerCase() === 'false' is true → returns BOOLEAN → mutation created.
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.BOOLEAN,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = TestUtil.createArgNode('false')
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('false')
    })
  })

  describe('Given a float literal argument with a dot matching Double return type', () => {
    it('Then should create mutation (exercises numeric-with-dot branch of resolveExpressionApexType)', () => {
      // Arrange — '3.14' starts with digit and contains '.', so resolves to DOUBLE
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'Double',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.DOUBLE,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = TestUtil.createArgNode('3.14')
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('3.14')
    })
  })

  describe('Given a Long literal argument matching Long return type', () => {
    it('Then should create mutation (exercises numeric-with-L branch of resolveExpressionApexType)', () => {
      // Arrange — '10L' starts with digit and ends with L, so resolves to LONG
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'Long',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.LONG,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = TestUtil.createArgNode('10L')
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('10L')
    })
  })

  describe('Given a dot expression with boolean false argument matching Boolean return type', () => {
    it('Then should create mutation (kills || → && mutant in resolveExpressionApexType for dot path)', () => {
      // Arrange — exercises the 'false' → BOOLEAN branch for the dot expression path
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.BOOLEAN,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      const argNode = TestUtil.createArgNode('false')
      const ctx = TestUtil.createDotExpressionInMethod(
        'obj',
        'transform',
        'testMethod',
        [argNode]
      )

      // Act
      sut.enterDotExpression(ctx as unknown as DotExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('false')
    })
  })

  describe('Given a method call where argType does not equal returnType (non-null but mismatched)', () => {
    it('Then should not create mutations when Long arg is passed to String-returning method', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      // '42L' resolves to APEX_TYPE.LONG, which !== APEX_TYPE.STRING
      const argNode = TestUtil.createArgNode('42L')
      const ctx = TestUtil.createMethodCallExpressionInMethod(
        'process',
        [argNode],
        'testMethod'
      )

      // Act
      sut.enterMethodCallExpression(
        ctx as unknown as MethodCallExpressionContext
      )

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression where argType does not equal returnType', () => {
    it('Then should not create mutations when Long arg passed to String-returning dot method', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const sut = new ArgumentPropagationMutator(typeRegistry)

      // '42L' resolves to APEX_TYPE.LONG, which !== APEX_TYPE.STRING
      const argNode = TestUtil.createArgNode('42L')
      const ctx = TestUtil.createDotExpressionInMethod(
        'obj',
        'transform',
        'testMethod',
        [argNode]
      )

      // Act
      sut.enterDotExpression(ctx as unknown as DotExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })
})
