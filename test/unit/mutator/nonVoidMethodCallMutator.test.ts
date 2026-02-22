import { ParserRuleContext } from 'antlr4ts'
import {
  DotExpressionContext,
  MethodCallExpressionContext,
  MethodDeclarationContext,
  NewExpressionContext,
} from 'apex-parser'
import { NonVoidMethodCallMutator } from '../../../src/mutator/nonVoidMethodCallMutator.js'
import type { TypeMatcher } from '../../../src/service/typeMatcher.js'
import { APEX_TYPE, ApexType } from '../../../src/type/ApexMethod.js'
import { TypeRegistry } from '../../../src/type/TypeRegistry.js'
import { TestUtil } from '../../utils/testUtil.js'

function createTypeRegistryWithVars(
  methodName: string,
  variables: Map<string, string>,
  classFields?: Map<string, string>,
  matchers?: TypeMatcher[]
): TypeRegistry {
  const variableScopes = new Map([[methodName, variables]])
  return new TypeRegistry(
    new Map(),
    variableScopes,
    classFields ?? new Map(),
    matchers ?? []
  )
}

function setEnclosingMethod(ctx: ParserRuleContext, methodName: string): void {
  const methodCtx = Object.create(MethodDeclarationContext.prototype)
  methodCtx.children = [
    { text: 'void' },
    { text: methodName },
    { text: '(' },
    { text: ')' },
  ]
  Object.defineProperty(ctx, 'parent', {
    value: methodCtx,
    writable: true,
    configurable: true,
  })
}

function createSObjectFieldMatcher(
  sObjectTypes: Set<string>,
  fieldMap: Map<string, Map<string, ApexType>>
): TypeMatcher {
  return {
    matches: (typeName: string) => sObjectTypes.has(typeName.toLowerCase()),
    collect: () => {
      // no-op for test mock
    },
    collectedTypes: new Set(),
    getFieldType: (objectType: string, fieldName: string) => {
      const fields = fieldMap.get(objectType.toLowerCase())
      return fields?.get(fieldName.toLowerCase())
    },
  }
}

const createMethodCallExpression = (
  methodCallText: string
): ParserRuleContext => {
  const node = {
    text: methodCallText,
    start: TestUtil.createToken(1, 0),
    stop: TestUtil.createToken(1, methodCallText.length),
    childCount: 1,
    parent: null,
    children: [],
    getChild: () => null,
  } as unknown as ParserRuleContext

  Object.setPrototypeOf(node, MethodCallExpressionContext.prototype)
  return node
}

const createDotExpression = (text: string): ParserRuleContext => {
  const node = {
    text,
    start: TestUtil.createToken(1, 0),
    stop: TestUtil.createToken(1, text.length),
    childCount: 1,
    parent: null,
    children: [],
    getChild: () => null,
  } as unknown as ParserRuleContext

  Object.setPrototypeOf(node, DotExpressionContext.prototype)
  return node
}

const createVariableDeclarationStatement = (
  typeName: string,
  varName: string,
  initializer: ParserRuleContext
): ParserRuleContext => {
  const variableDeclarator = {
    text: `${varName}=${initializer.text}`,
    children: [{ text: varName }, { text: '=' }, initializer],
    childCount: 3,
    getChild: (i: number) => {
      if (i === 0) return { text: varName }
      if (i === 1) return { text: '=' }
      return initializer
    },
  } as unknown as ParserRuleContext
  Object.setPrototypeOf(variableDeclarator, ParserRuleContext.prototype)

  const variableDeclarators = {
    text: variableDeclarator.text,
    children: [variableDeclarator],
    childCount: 1,
  } as unknown as ParserRuleContext
  Object.setPrototypeOf(variableDeclarators, ParserRuleContext.prototype)

  const localVarDecl = {
    children: [{ text: typeName }, variableDeclarators],
    childCount: 2,
    start: TestUtil.createToken(1, 0),
    getChild: (i: number) =>
      i === 0 ? { text: typeName } : variableDeclarators,
  } as unknown as ParserRuleContext
  Object.setPrototypeOf(localVarDecl, ParserRuleContext.prototype)

  return {
    children: [localVarDecl, { text: ';' }],
    childCount: 2,
    start: TestUtil.createToken(1, 0),
  } as unknown as ParserRuleContext
}

const createAssignExpression = (
  lhs: string,
  rhs: ParserRuleContext
): ParserRuleContext => {
  return {
    childCount: 3,
    children: [{ text: lhs }, { text: '=' }, rhs],
    getChild: (i: number) => {
      if (i === 0) return { text: lhs }
      if (i === 1) return { text: '=' }
      return rhs
    },
  } as unknown as ParserRuleContext
}

describe('NonVoidMethodCallMutator', () => {
  describe('TypeRegistry path', () => {
    describe('enterLocalVariableDeclarationStatement', () => {
      describe('Given type to default value mapping', () => {
        const testCases = [
          { typeName: 'Integer', expected: '0' },
          { typeName: 'int', expected: '0' },
          { typeName: 'Long', expected: '0L' },
          { typeName: 'Double', expected: '0.0' },
          { typeName: 'Decimal', expected: '0.0' },
          { typeName: 'String', expected: "''" },
          { typeName: 'Id', expected: "''" },
          { typeName: 'Boolean', expected: 'false' },
          { typeName: 'Blob', expected: "Blob.valueOf('')" },
          { typeName: 'List<String>', expected: 'new List<String>()' },
          { typeName: 'Set<Integer>', expected: 'new Set<Integer>()' },
          {
            typeName: 'Map<String, Integer>',
            expected: 'new Map<String, Integer>()',
          },
          { typeName: 'Account', expected: 'null' },
          { typeName: 'Date', expected: 'null' },
          { typeName: 'DateTime', expected: 'null' },
          { typeName: 'CustomClass', expected: 'null' },
        ]

        it.each(
          testCases
        )('Given $typeName variable declaration with method call, When entering statement, Then should replace with $expected', ({
          typeName,
          expected,
        }) => {
          // Arrange
          const typeRegistry = createTypeRegistryWithVars(
            'testMethod',
            new Map()
          )
          const sut = new NonVoidMethodCallMutator(typeRegistry)
          sut._mutations = []
          const methodCall = createMethodCallExpression('getValue()')
          const ctx = createVariableDeclarationStatement(
            typeName,
            'x',
            methodCall
          )

          // Act
          sut.enterLocalVariableDeclarationStatement(ctx)

          // Assert
          expect(sut._mutations).toHaveLength(1)
          expect(sut._mutations[0].replacement).toBe(expected)
          expect(sut._mutations[0].mutationName).toBe(
            'NonVoidMethodCallMutator'
          )
        })
      })

      it('Given dot expression method call, When entering statement, Then should mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createDotExpression('helper.getValue()')
        const ctx = createVariableDeclarationStatement(
          'Integer',
          'x',
          methodCall
        )

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })

      it('Given chained method call, When entering statement, Then should mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createDotExpression('obj.getInner().getValue()')
        const ctx = createVariableDeclarationStatement(
          'String',
          's',
          methodCall
        )

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })

      it('Given constructor call, When entering statement, Then should NOT mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const constructorCall = {
          text: 'newAccount()',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 13),
          childCount: 1,
          children: [],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(constructorCall, NewExpressionContext.prototype)

        const ctx = createVariableDeclarationStatement(
          'Account',
          'acc',
          constructorCall
        )

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given non-method-call expression, When entering statement, Then should NOT mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const literalExpression = {
          text: '42',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 2),
          childCount: 1,
        } as unknown as ParserRuleContext

        Object.setPrototypeOf(literalExpression, ParserRuleContext.prototype)

        const ctx = createVariableDeclarationStatement(
          'Integer',
          'x',
          literalExpression
        )

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given array type syntax, When entering statement, Then should mutate with List constructor', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getItems()')
        const ctx = createVariableDeclarationStatement(
          'String[]',
          'items',
          methodCall
        )

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('new List<String>()')
      })
    })

    describe('enterAssignExpression', () => {
      it('Given known variable type, When assigning method call, Then should mutate with default value', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['x', 'integer']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression('x', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })

      it('Given unknown variable, When assigning method call, Then should NOT mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression('unknownVar', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given class field, When assigning method call, Then should mutate with field type default', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map(),
          new Map([['myField', 'string']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getName()')
        const assignCtx = createAssignExpression('myField', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })

      it('Given no enclosing method, When assigning method call, Then should NOT mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['x', 'integer']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression('x', methodCall)

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given SObject field via matcher, When assigning method call to dotted field, Then should mutate with ApexType default', () => {
        // Arrange
        const fieldMap = new Map([
          ['account', new Map([['name', APEX_TYPE.STRING]])],
        ])
        const matcher = createSObjectFieldMatcher(
          new Set(['account']),
          fieldMap
        )
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['acc', 'account']]),
          new Map(),
          [matcher]
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getName()')
        const assignCtx = createAssignExpression('acc.Name', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })

      it('Given SObject numeric field via matcher, When assigning method call, Then should mutate with numeric default', () => {
        // Arrange
        const fieldMap = new Map([
          ['account', new Map([['numberofemployees', APEX_TYPE.INTEGER]])],
        ])
        const matcher = createSObjectFieldMatcher(
          new Set(['account']),
          fieldMap
        )
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['acc', 'account']]),
          new Map(),
          [matcher]
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getCount()')
        const assignCtx = createAssignExpression(
          'acc.NumberOfEmployees',
          methodCall
        )
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })

      it('Given SObject field that cannot be resolved, When assigning method call, Then should NOT mutate', () => {
        // Arrange
        const fieldMap = new Map([['account', new Map<string, ApexType>()]])
        const matcher = createSObjectFieldMatcher(
          new Set(['account']),
          fieldMap
        )
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['acc', 'account']]),
          new Map(),
          [matcher]
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression(
          'acc.UnknownField__c',
          methodCall
        )
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given unknown root variable in dotted expression, When assigning method call, Then should NOT mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression('unknownObj.field', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given non-method-call RHS, When assigning, Then should NOT mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['x', 'integer']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const literalExpr = {
          text: '42',
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(literalExpr, ParserRuleContext.prototype)

        const assignCtx = createAssignExpression('x', literalExpr)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      describe('Given ApexType field defaults via TypeRegistry matcher', () => {
        const apexTypeTestCases = [
          { apexType: APEX_TYPE.STRING, fieldName: 'name', expected: "''" },
          { apexType: APEX_TYPE.ID, fieldName: 'extid', expected: "''" },
          { apexType: APEX_TYPE.INTEGER, fieldName: 'count', expected: '0' },
          { apexType: APEX_TYPE.LONG, fieldName: 'bignum', expected: '0L' },
          { apexType: APEX_TYPE.DOUBLE, fieldName: 'rate', expected: '0.0' },
          { apexType: APEX_TYPE.DECIMAL, fieldName: 'amount', expected: '0.0' },
          {
            apexType: APEX_TYPE.BOOLEAN,
            fieldName: 'active',
            expected: 'false',
          },
          {
            apexType: APEX_TYPE.BLOB,
            fieldName: 'data',
            expected: "Blob.valueOf('')",
          },
          { apexType: APEX_TYPE.DATE, fieldName: 'created', expected: 'null' },
        ]

        it.each(
          apexTypeTestCases
        )('Given SObject field of ApexType $apexType, When assigning method call, Then should return $expected', ({
          apexType,
          fieldName,
          expected,
        }) => {
          // Arrange
          const fieldMap = new Map([
            ['account', new Map([[fieldName.toLowerCase(), apexType]])],
          ])
          const matcher = createSObjectFieldMatcher(
            new Set(['account']),
            fieldMap
          )
          const typeRegistry = createTypeRegistryWithVars(
            'testMethod',
            new Map([['acc', 'account']]),
            new Map(),
            [matcher]
          )
          const sut = new NonVoidMethodCallMutator(typeRegistry)
          sut._mutations = []
          const methodCall = createMethodCallExpression('getValue()')
          const assignCtx = createAssignExpression(
            `acc.${fieldName}`,
            methodCall
          )
          setEnclosingMethod(assignCtx, 'testMethod')

          // Act
          sut.enterAssignExpression(assignCtx)

          // Assert
          expect(sut._mutations).toHaveLength(1)
          expect(sut._mutations[0].replacement).toBe(expected)
        })
      })
    })

    describe('edge cases', () => {
      it('Given statement with null children, When entering, Then should not mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const ctx = {
          children: null,
          childCount: 0,
        } as unknown as ParserRuleContext

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given statement where first child is not ParserRuleContext, When entering, Then should not mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const ctx = {
          children: [{ text: 'notPRC' }],
          childCount: 1,
        } as unknown as ParserRuleContext

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given statement where declCtx has insufficient children, When entering, Then should not mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const declCtx = {
          children: [{ text: 'Integer' }],
          childCount: 1,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declCtx, ParserRuleContext.prototype)
        const ctx = {
          children: [declCtx],
          childCount: 1,
        } as unknown as ParserRuleContext

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given statement where declarators is not ParserRuleContext, When entering, Then should not mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const declCtx = {
          children: [{ text: 'Integer' }, { text: 'x = getValue()' }],
          childCount: 2,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declCtx, ParserRuleContext.prototype)
        const ctx = {
          children: [declCtx],
          childCount: 1,
        } as unknown as ParserRuleContext

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given no typeRegistry, When entering assign expression, Then should not mutate', () => {
        // Arrange
        const sut = new NonVoidMethodCallMutator()
        sut._mutations = []
        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression('x', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given declarators containing non-ParserRuleContext children, When entering, Then should skip them', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const commaNode = { text: ',' }
        const methodCall = createMethodCallExpression('getValue()')
        const declarator = {
          text: 'x=getValue()',
          children: [{ text: 'x' }, { text: '=' }, methodCall],
          childCount: 3,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)

        const declarators = {
          text: 'x=getValue()',
          children: [declarator, commaNode],
          childCount: 2,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarators, ParserRuleContext.prototype)

        const declCtx = {
          children: [{ text: 'Integer' }, declarators],
          childCount: 2,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declCtx, ParserRuleContext.prototype)

        const ctx = {
          children: [declCtx, { text: ';' }],
          childCount: 2,
        } as unknown as ParserRuleContext

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
      })

      it('Given declarator with fewer than 3 children, When entering, Then should not mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const declarator = {
          text: 'x',
          children: [{ text: 'x' }, { text: ';' }],
          childCount: 2,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)

        const declarators = {
          text: 'x',
          children: [declarator],
          childCount: 1,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarators, ParserRuleContext.prototype)

        const declCtx = {
          children: [{ text: 'Integer' }, declarators],
          childCount: 2,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declCtx, ParserRuleContext.prototype)

        const ctx = {
          children: [declCtx, { text: ';' }],
          childCount: 2,
        } as unknown as ParserRuleContext

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given declarator with no equals sign, When entering, Then should not mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const declarator = {
          text: 'x:Integer',
          children: [{ text: 'x' }, { text: ':' }, { text: 'Integer' }],
          childCount: 3,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)

        const declarators = {
          text: 'x:Integer',
          children: [declarator],
          childCount: 1,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarators, ParserRuleContext.prototype)

        const declCtx = {
          children: [{ text: 'Integer' }, declarators],
          childCount: 2,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declCtx, ParserRuleContext.prototype)

        const ctx = {
          children: [declCtx, { text: ';' }],
          childCount: 2,
        } as unknown as ParserRuleContext

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given declarator where = is last child, When entering, Then should not mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const declarator = {
          text: 'x y =',
          children: [{ text: 'x' }, { text: 'y' }, { text: '=' }],
          childCount: 3,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)

        const declarators = {
          text: 'x y =',
          children: [declarator],
          childCount: 1,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarators, ParserRuleContext.prototype)

        const declCtx = {
          children: [{ text: 'Integer' }, declarators],
          childCount: 2,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declCtx, ParserRuleContext.prototype)

        const ctx = {
          children: [declCtx, { text: ';' }],
          childCount: 2,
        } as unknown as ParserRuleContext

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given declarator where initializer is not ParserRuleContext, When entering, Then should not mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const declarator = {
          text: 'x=42',
          children: [{ text: 'x' }, { text: '=' }, { text: '42' }],
          childCount: 3,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)

        const declarators = {
          text: 'x=42',
          children: [declarator],
          childCount: 1,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarators, ParserRuleContext.prototype)

        const declCtx = {
          children: [{ text: 'Integer' }, declarators],
          childCount: 2,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declCtx, ParserRuleContext.prototype)

        const ctx = {
          children: [declCtx, { text: ';' }],
          childCount: 2,
        } as unknown as ParserRuleContext

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given assignment with wrong child count, When entering, Then should not mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const ctx = {
          childCount: 2,
        } as unknown as ParserRuleContext

        // Act
        sut.enterAssignExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given assignment where RHS is not ParserRuleContext, When entering, Then should not mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const ctx = {
          childCount: 3,
          getChild: (i: number) => {
            if (i === 0) return { text: 'x' }
            if (i === 1) return { text: '=' }
            return { text: '42' }
          },
        } as unknown as ParserRuleContext

        // Act
        sut.enterAssignExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given expression with children that are not method calls, When entering statement, Then should not mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const plainChild = {
          text: 'x',
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(plainChild, ParserRuleContext.prototype)

        const wrapperExpression = {
          text: '(x)',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 3),
          childCount: 1,
          children: [plainChild],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(wrapperExpression, ParserRuleContext.prototype)

        const ctx = createVariableDeclarationStatement(
          'Integer',
          'y',
          wrapperExpression
        )

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given method call in wrapper expression children, When entering statement, Then should detect and mutate', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCallChild = {
          text: 'getValue()',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 10),
          childCount: 0,
          children: [],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(
          methodCallChild,
          MethodCallExpressionContext.prototype
        )

        const wrapperExpression = {
          text: '(getValue())',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 12),
          childCount: 1,
          children: [methodCallChild],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(wrapperExpression, ParserRuleContext.prototype)

        const ctx = createVariableDeclarationStatement(
          'Integer',
          'x',
          wrapperExpression
        )

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })
    })
  })
})
