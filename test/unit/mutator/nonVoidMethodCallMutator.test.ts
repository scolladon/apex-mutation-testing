import { ParserRuleContext } from 'antlr4ts'
import {
  DotExpressionContext,
  MethodCallExpressionContext,
  MethodDeclarationContext,
  NewExpressionContext,
} from 'apex-parser'
import { SObjectDescribeRepository } from '../../../src/adapter/sObjectDescribeRepository.js'
import { NonVoidMethodCallMutator } from '../../../src/mutator/nonVoidMethodCallMutator.js'
import type { TypeMatcher } from '../../../src/service/typeMatcher.js'
import { ApexType } from '../../../src/type/ApexMethod.js'
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
          ['account', new Map([['name', ApexType.STRING]])],
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
          ['account', new Map([['numberofemployees', ApexType.INTEGER]])],
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
          { apexType: ApexType.STRING, fieldName: 'name', expected: "''" },
          { apexType: ApexType.ID, fieldName: 'extid', expected: "''" },
          { apexType: ApexType.INTEGER, fieldName: 'count', expected: '0' },
          { apexType: ApexType.LONG, fieldName: 'bignum', expected: '0L' },
          { apexType: ApexType.DOUBLE, fieldName: 'rate', expected: '0.0' },
          { apexType: ApexType.DECIMAL, fieldName: 'amount', expected: '0.0' },
          {
            apexType: ApexType.BOOLEAN,
            fieldName: 'active',
            expected: 'false',
          },
          {
            apexType: ApexType.BLOB,
            fieldName: 'data',
            expected: "Blob.valueOf('')",
          },
          { apexType: ApexType.DATE, fieldName: 'created', expected: 'null' },
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

  describe('backward compatibility (legacy TypeTrackingBaseListener path)', () => {
    let sut: NonVoidMethodCallMutator

    beforeEach(() => {
      sut = new NonVoidMethodCallMutator()
    })

    describe('enterLocalVariableDeclarationStatement', () => {
      describe('type to default value mapping', () => {
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
        )('should replace method call with $expected for $typeName type', ({
          typeName,
          expected,
        }) => {
          sut._mutations = []
          const methodCall = createMethodCallExpression('getValue()')
          const ctx = createVariableDeclarationStatement(
            typeName,
            'x',
            methodCall
          )

          sut.enterLocalVariableDeclarationStatement(ctx)

          expect(sut._mutations).toHaveLength(1)
          expect(sut._mutations[0].replacement).toBe(expected)
          expect(sut._mutations[0].mutationName).toBe(
            'NonVoidMethodCallMutator'
          )
        })
      })

      it('should handle dot expression method calls', () => {
        sut._mutations = []
        const methodCall = createDotExpression('helper.getValue()')
        const ctx = createVariableDeclarationStatement(
          'Integer',
          'x',
          methodCall
        )

        sut.enterLocalVariableDeclarationStatement(ctx)

        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })

      it('should handle chained method calls', () => {
        sut._mutations = []
        const methodCall = createDotExpression('obj.getInner().getValue()')
        const ctx = createVariableDeclarationStatement(
          'String',
          's',
          methodCall
        )

        sut.enterLocalVariableDeclarationStatement(ctx)

        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })

      it('should NOT mutate constructor calls', () => {
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

        sut.enterLocalVariableDeclarationStatement(ctx)

        expect(sut._mutations).toHaveLength(0)
      })

      it('should NOT mutate non-method-call expressions', () => {
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

        sut.enterLocalVariableDeclarationStatement(ctx)

        expect(sut._mutations).toHaveLength(0)
      })

      it('should handle array type syntax', () => {
        sut._mutations = []
        const methodCall = createMethodCallExpression('getItems()')
        const ctx = createVariableDeclarationStatement(
          'String[]',
          'items',
          methodCall
        )

        sut.enterLocalVariableDeclarationStatement(ctx)

        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('new List<String>()')
      })
    })

    describe('enterAssignExpression', () => {
      it('should mutate assignment when variable type is known', () => {
        sut._mutations = []
        const methodDecl = TestUtil.createMethodDeclaration(
          'void',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodDecl)

        const varDecl = TestUtil.createLocalVariableDeclaration('Integer', 'x')
        sut.enterLocalVariableDeclaration(varDecl)

        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression('x', methodCall)

        sut.enterAssignExpression(assignCtx)

        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })

      it('should NOT mutate assignment when variable type is unknown', () => {
        sut._mutations = []
        const methodDecl = TestUtil.createMethodDeclaration(
          'void',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodDecl)

        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression('unknownVar', methodCall)

        sut.enterAssignExpression(assignCtx)

        expect(sut._mutations).toHaveLength(0)
      })

      it('should handle class field assignments', () => {
        sut._mutations = []
        const fieldDecl = TestUtil.createFieldDeclaration('String', 'myField')
        sut.enterFieldDeclaration(fieldDecl)

        const methodDecl = TestUtil.createMethodDeclaration(
          'void',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodDecl)

        const methodCall = createMethodCallExpression('getName()')
        const assignCtx = createAssignExpression('myField', methodCall)

        sut.enterAssignExpression(assignCtx)

        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })

      it('should reset method scope variables on new method', () => {
        sut._mutations = []

        const methodDecl1 = TestUtil.createMethodDeclaration('void', 'method1')
        sut.enterMethodDeclaration(methodDecl1)
        const varDecl = TestUtil.createLocalVariableDeclaration('Integer', 'x')
        sut.enterLocalVariableDeclaration(varDecl)

        const methodDecl2 = TestUtil.createMethodDeclaration('void', 'method2')
        sut.enterMethodDeclaration(methodDecl2)

        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression('x', methodCall)

        sut.enterAssignExpression(assignCtx)

        expect(sut._mutations).toHaveLength(0)
      })

      it('should NOT mutate when RHS is not a method call', () => {
        sut._mutations = []
        const methodDecl = TestUtil.createMethodDeclaration(
          'void',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodDecl)

        const varDecl = TestUtil.createLocalVariableDeclaration('Integer', 'x')
        sut.enterLocalVariableDeclaration(varDecl)

        const literalExpr = {
          text: '42',
        } as unknown as ParserRuleContext

        Object.setPrototypeOf(literalExpr, ParserRuleContext.prototype)

        const assignCtx = createAssignExpression('x', literalExpr)

        sut.enterAssignExpression(assignCtx)

        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('SObject field assignments', () => {
      it('should mutate SObject field assignment when type is resolvable', () => {
        sut._mutations = []

        const mockSObjectRepo = {
          isSObject: jest.fn().mockReturnValue(true),
          resolveFieldType: jest.fn().mockReturnValue(ApexType.STRING),
        } as unknown as SObjectDescribeRepository

        sut._sObjectDescribeRepository = mockSObjectRepo

        const methodDecl = TestUtil.createMethodDeclaration(
          'void',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodDecl)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'Account',
          'acc'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        const methodCall = createMethodCallExpression('getName()')
        const assignCtx = createAssignExpression('acc.Name', methodCall)

        sut.enterAssignExpression(assignCtx)

        expect(mockSObjectRepo.isSObject).toHaveBeenCalledWith('account')
        expect(mockSObjectRepo.resolveFieldType).toHaveBeenCalledWith(
          'account',
          'Name'
        )
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })

      it('should handle numeric SObject fields', () => {
        sut._mutations = []

        const mockSObjectRepo = {
          isSObject: jest.fn().mockReturnValue(true),
          resolveFieldType: jest.fn().mockReturnValue(ApexType.INTEGER),
        } as unknown as SObjectDescribeRepository

        sut._sObjectDescribeRepository = mockSObjectRepo

        const methodDecl = TestUtil.createMethodDeclaration(
          'void',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodDecl)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'Account',
          'acc'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        const methodCall = createMethodCallExpression('getCount()')
        const assignCtx = createAssignExpression(
          'acc.NumberOfEmployees',
          methodCall
        )

        sut.enterAssignExpression(assignCtx)

        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })

      it('should NOT mutate when SObject field type cannot be resolved', () => {
        sut._mutations = []

        const mockSObjectRepo = {
          isSObject: jest.fn().mockReturnValue(true),
          resolveFieldType: jest.fn().mockReturnValue(undefined),
        } as unknown as SObjectDescribeRepository

        sut._sObjectDescribeRepository = mockSObjectRepo

        const methodDecl = TestUtil.createMethodDeclaration(
          'void',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodDecl)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'Account',
          'acc'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression(
          'acc.UnknownField__c',
          methodCall
        )

        sut.enterAssignExpression(assignCtx)

        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('variable tracking', () => {
      it('should track formal parameters', () => {
        sut._mutations = []
        const methodDecl = TestUtil.createMethodDeclaration(
          'void',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodDecl)

        const paramDecl = TestUtil.createFormalParameter('String', 'input')
        sut.enterFormalParameter(paramDecl)

        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression('input', methodCall)

        sut.enterAssignExpression(assignCtx)

        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })

      it('should track enhanced for control variables', () => {
        sut._mutations = []
        const methodDecl = TestUtil.createMethodDeclaration(
          'void',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodDecl)

        const forControl = TestUtil.createEnhancedForControl('Integer', 'item')
        sut.enterEnhancedForControl(forControl)

        const methodCall = createMethodCallExpression('getNext()')
        const assignCtx = createAssignExpression('item', methodCall)

        sut.enterAssignExpression(assignCtx)

        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })
    })

    describe('edge cases', () => {
      it('should handle statement with insufficient children', () => {
        sut._mutations = []
        const ctx = {
          children: null,
          childCount: 0,
        } as unknown as ParserRuleContext

        sut.enterLocalVariableDeclarationStatement(ctx)

        expect(sut._mutations).toHaveLength(0)
      })

      it('should handle assignment with wrong child count', () => {
        sut._mutations = []
        const ctx = {
          childCount: 2,
        } as unknown as ParserRuleContext

        sut.enterAssignExpression(ctx)

        expect(sut._mutations).toHaveLength(0)
      })

      it('should handle declaration where first child is not ParserRuleContext', () => {
        sut._mutations = []
        const ctx = {
          children: [{ text: 'notARule' }],
          childCount: 1,
        } as unknown as ParserRuleContext

        sut.enterLocalVariableDeclarationStatement(ctx)

        expect(sut._mutations).toHaveLength(0)
      })

      it('should handle declaration where declCtx has no children', () => {
        sut._mutations = []
        const declCtx = {
          children: null,
          childCount: 0,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declCtx, ParserRuleContext.prototype)

        const ctx = {
          children: [declCtx],
          childCount: 1,
        } as unknown as ParserRuleContext

        sut.enterLocalVariableDeclarationStatement(ctx)

        expect(sut._mutations).toHaveLength(0)
      })

      it('should handle declaration where declarators is not ParserRuleContext', () => {
        sut._mutations = []
        const declCtx = {
          children: [{ text: 'Integer' }, { text: 'x' }],
          childCount: 2,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declCtx, ParserRuleContext.prototype)

        const ctx = {
          children: [declCtx],
          childCount: 1,
        } as unknown as ParserRuleContext

        sut.enterLocalVariableDeclarationStatement(ctx)

        expect(sut._mutations).toHaveLength(0)
      })

      it('should handle assignment where RHS is not ParserRuleContext', () => {
        sut._mutations = []
        const ctx = {
          childCount: 3,
          getChild: (i: number) => {
            if (i === 0) return { text: 'x' }
            if (i === 1) return { text: '=' }
            return { text: '42' }
          },
        } as unknown as ParserRuleContext

        sut.enterAssignExpression(ctx)

        expect(sut._mutations).toHaveLength(0)
      })

      it('should handle variable declarator without equals sign', () => {
        sut._mutations = []
        const declarator = {
          children: [{ text: 'x' }, { text: ':' }, { text: 'value' }],
          childCount: 3,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)

        const declarators = {
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
          children: [declCtx],
          childCount: 1,
        } as unknown as ParserRuleContext

        sut.enterLocalVariableDeclarationStatement(ctx)

        expect(sut._mutations).toHaveLength(0)
      })

      it('should handle variable declarator where initializer is not ParserRuleContext', () => {
        sut._mutations = []
        const declarator = {
          children: [{ text: 'x' }, { text: '=' }, { text: '42' }],
          childCount: 3,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)

        const declarators = {
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
          children: [declCtx],
          childCount: 1,
        } as unknown as ParserRuleContext

        sut.enterLocalVariableDeclarationStatement(ctx)

        expect(sut._mutations).toHaveLength(0)
      })

      it('should detect method call in wrapper expression children', () => {
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

        sut.enterLocalVariableDeclarationStatement(ctx)

        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })

      it('should NOT mutate field access when root variable type is unknown', () => {
        sut._mutations = []
        const methodDecl = TestUtil.createMethodDeclaration(
          'void',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodDecl)

        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression('unknownObj.field', methodCall)

        sut.enterAssignExpression(assignCtx)

        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('SObject field type mapping via generateDefaultValueFromApexType', () => {
      const apexTypeTestCases = [
        { apexType: ApexType.LONG, expected: '0L' },
        { apexType: ApexType.DOUBLE, expected: '0.0' },
        { apexType: ApexType.DECIMAL, expected: '0.0' },
        { apexType: ApexType.BOOLEAN, expected: 'false' },
        { apexType: ApexType.BLOB, expected: "Blob.valueOf('')" },
        { apexType: ApexType.DATE, expected: 'null' },
      ]

      it.each(
        apexTypeTestCases
      )('should return $expected for ApexType.$apexType SObject field', ({
        apexType,
        expected,
      }) => {
        sut._mutations = []

        const mockSObjectRepo = {
          isSObject: jest.fn().mockReturnValue(true),
          resolveFieldType: jest.fn().mockReturnValue(apexType),
        } as unknown as SObjectDescribeRepository

        sut._sObjectDescribeRepository = mockSObjectRepo

        const methodDecl = TestUtil.createMethodDeclaration(
          'void',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodDecl)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'Account',
          'acc'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression('acc.SomeField', methodCall)

        sut.enterAssignExpression(assignCtx)

        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe(expected)
      })
    })
  })
})
