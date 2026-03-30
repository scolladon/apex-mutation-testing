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

      it('Given dotted expression with unknown SObject type, When assigning method call, Then should NOT mutate', () => {
        // Arrange — the variable type is unknown so resolveType returns null
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

      it('Given simple List<String> variable, When assigning method call, Then replaces with new List<String>() not null (kills . → "" mutant)', () => {
        // Arrange — lhsText has no dot; original code uses generateDefaultValue which handles list types.
        // The StringLiteral mutant changes '.' to "" making includes("") always true,
        // taking the getDefaultValueForApexType path which returns null for LIST (no typeName).
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['myList', 'List<String>']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getItems()')
        const assignCtx = createAssignExpression('myList', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert — generateDefaultValue('List<String>') = 'new List<String>()'; mutant would give 'null'
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('new List<String>()')
      })

      it('Given dotted assignment where getDefaultValueForApexType returns null (no typeName), When assigning method call, Then replacement is null literal', () => {
        // Arrange — the field is of type VOID (default fallback) which maps to null
        const fieldMap = new Map([
          ['account', new Map([['customfield', APEX_TYPE.VOID]])],
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
        const assignCtx = createAssignExpression('acc.customField', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert — null is the fallback when getDefaultValueForApexType returns null
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('null')
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

      it('Given declarators that IS ParserRuleContext but has null children, When entering, Then should not mutate (kills || → && mutant)', () => {
        // Arrange — the declarators node IS a PRC (first condition false with ||), but has no children.
        // With || → && mutant, both conditions must be true, so null-children PRC would NOT trigger the guard.
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const declarators = {
          text: 'x',
          children: null,
          childCount: 0,
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

        // Assert — no children means no declarators to process
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

      it('Given dot expression as child of wrapper, When entering statement, Then should detect and mutate', () => {
        // Arrange — kills mutations on `child instanceof DotExpressionContext` check
        // (if that check is removed, only MethodCallExpressionContext children are detected)
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const dotChild = {
          text: 'obj.getValue()',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 14),
          childCount: 0,
          children: [],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(dotChild, DotExpressionContext.prototype)

        const wrapperExpression = {
          text: '(obj.getValue())',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 16),
          childCount: 1,
          children: [dotChild],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(wrapperExpression, ParserRuleContext.prototype)

        const ctx = createVariableDeclarationStatement(
          'String',
          's',
          wrapperExpression
        )

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })
    })

    describe('enterAssignExpression with wrapper expression RHS containing method call child', () => {
      it('Given wrapper PRC containing MethodCallExpression child as RHS, When assigning to known variable, Then should mutate (kills isMethodCall children check via enterAssignExpression path)', () => {
        // Arrange — exercises the `isMethodCall` children-loop detection path when called from
        // `enterAssignExpression`. The RHS is NOT directly a MCEL/DEC but CONTAINS one as a child.
        // Mutations targeting the children check in `isMethodCall` (e.g., `child instanceof MCEL → false`)
        // would make `isMethodCall` return false → enterAssignExpression returns early → no mutation.
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['result', 'integer']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const methodCallChild = {
          text: 'compute()',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 9),
          childCount: 0,
          children: [],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(
          methodCallChild,
          MethodCallExpressionContext.prototype
        )

        const wrapperRhs = {
          text: '(compute())',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 11),
          childCount: 1,
          children: [methodCallChild],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(wrapperRhs, ParserRuleContext.prototype)

        const assignCtx = createAssignExpression('result', wrapperRhs)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert — isMethodCall(wrapperRhs) returns true via children check → should mutate
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })

      it('Given wrapper PRC containing DotExpression child as RHS, When assigning to known String variable, Then should mutate (kills DotExpressionContext child check in isMethodCall)', () => {
        // Arrange — exercises the `child instanceof DotExpressionContext` check in isMethodCall
        // when called from enterAssignExpression. Mutations removing this check would cause
        // the DEC child to not be recognized → isMethodCall returns false → no mutation.
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['name', 'string']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const dotChild = {
          text: 'obj.getName()',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 13),
          childCount: 0,
          children: [],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(dotChild, DotExpressionContext.prototype)

        const wrapperRhs = {
          text: '(obj.getName())',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 15),
          childCount: 1,
          children: [dotChild],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(wrapperRhs, ParserRuleContext.prototype)

        const assignCtx = createAssignExpression('name', wrapperRhs)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert — DEC child detected → isMethodCall returns true → should mutate with ''
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })

      it('Given wrapper PRC with null children as RHS, When assigning, Then should not mutate (kills if(node.children) → if(true) in isMethodCall)', () => {
        // Arrange — exercises the `if (node.children)` null-guard in isMethodCall when called
        // from enterAssignExpression. With mutation to `if (true)`, for(null) would throw.
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['x', 'integer']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const wrapperRhs = {
          text: 'x',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 1),
          childCount: 0,
          children: null,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(wrapperRhs, ParserRuleContext.prototype)

        const assignCtx = createAssignExpression('x', wrapperRhs)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act & Assert — no throw, no mutation
        expect(() => sut.enterAssignExpression(assignCtx)).not.toThrow()
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('enterAssignExpression with dot expression RHS', () => {
      it('Given dot expression as RHS, When assigning to known variable, Then should mutate', () => {
        // Arrange — exercises isMethodCall for DotExpressionContext in the assignment path
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['result', 'string']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const dotRhs = createDotExpression('helper.getName()')
        const assignCtx = createAssignExpression('result', dotRhs)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })

      it('Given dot expression as RHS with integer variable, When assigning, Then should mutate with numeric default', () => {
        // Arrange
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['count', 'integer']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const dotRhs = createDotExpression('repo.getCount()')
        const assignCtx = createAssignExpression('count', dotRhs)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })
    })

    describe('enterAssignExpression with Set and Map variable types', () => {
      it('Given Set<String> variable, When assigning method call, Then replaces with new Set<String>()', () => {
        // Arrange — exercises generateDefaultValue set branch via enterAssignExpression
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['mySet', 'Set<String>']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getNames()')
        const assignCtx = createAssignExpression('mySet', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('new Set<String>()')
      })

      it('Given Map<String,Integer> variable, When assigning method call, Then replaces with new Map<String,Integer>()', () => {
        // Arrange — exercises generateDefaultValue map branch via enterAssignExpression
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['myMap', 'Map<String,Integer>']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('buildMap()')
        const assignCtx = createAssignExpression('myMap', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('new Map<String,Integer>()')
      })

      it('Given String[] array-syntax variable, When assigning method call, Then replaces with new List<String>()', () => {
        // Arrange — exercises the endsWith('[]') branch of generateDefaultValue
        // via enterAssignExpression; type stored with [] suffix
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['items', 'String[]']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getItems()')
        const assignCtx = createAssignExpression('items', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('new List<String>()')
      })

      it('Given Blob variable, When assigning method call, Then replaces with Blob.valueOf(empty string)', () => {
        // Arrange — exercises generateDefaultValue blob path via enterAssignExpression
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['data', 'Blob']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('encode()')
        const assignCtx = createAssignExpression('data', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("Blob.valueOf('')")
      })

      it('Given Long variable, When assigning method call, Then replaces with 0L', () => {
        // Arrange — exercises generateDefaultValue long path via enterAssignExpression
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['size', 'Long']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('computeSize()')
        const assignCtx = createAssignExpression('size', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0L')
      })

      it('Given Boolean variable, When assigning method call, Then replaces with false', () => {
        // Arrange — exercises generateDefaultValue boolean path via enterAssignExpression
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['active', 'Boolean']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('isActive()')
        const assignCtx = createAssignExpression('active', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('false')
      })

      it('Given Double variable, When assigning method call, Then replaces with 0.0', () => {
        // Arrange — exercises generateDefaultValue double path via enterAssignExpression
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['rate', 'Double']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getRate()')
        const assignCtx = createAssignExpression('rate', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0.0')
      })

      it('Given Decimal variable, When assigning method call, Then replaces with 0.0', () => {
        // Arrange — exercises generateDefaultValue decimal path via enterAssignExpression
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['amount', 'Decimal']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getAmount()')
        const assignCtx = createAssignExpression('amount', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0.0')
      })

      it('Given Id variable, When assigning method call, Then replaces with empty string literal', () => {
        // Arrange — exercises generateDefaultValue id path via enterAssignExpression
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['recordId', 'Id']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('resolveId()')
        const assignCtx = createAssignExpression('recordId', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })

      it('Given int (short form) variable, When assigning method call, Then replaces with 0', () => {
        // Arrange — exercises generateDefaultValue int (alias) path via enterAssignExpression
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['num', 'int']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('parse()')
        const assignCtx = createAssignExpression('num', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })

      it('Given custom class variable, When assigning method call, Then replaces with null', () => {
        // Arrange — exercises generateDefaultValue null fallback via enterAssignExpression
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['account', 'Account']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('buildAccount()')
        const assignCtx = createAssignExpression('account', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('null')
      })
    })

    describe('guard clause || vs && kills', () => {
      it('Given declCtx that is a PRC with null children, When entering LVDS, Then should not mutate (kills || → && on declCtx.children guard)', () => {
        // Arrange
        // The guard `!declCtx.children || declCtx.children.length < 2` with || → && becomes
        // `!declCtx.children && declCtx.children.length < 2`. When children IS null, the mutant
        // would evaluate null.length and throw, whereas the original short-circuits safely.
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const declCtx = {
          children: null,
          childCount: 0,
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

      it('Given declarator PRC with null children, When entering LVDS, Then should not mutate (kills || → && on declarator.children guard)', () => {
        // Arrange
        // The guard `!ctx.children || ctx.children.length < 3` in processVariableDeclarator
        // with || → && becomes `!ctx.children && ctx.children.length < 3`.
        // When children IS null, the mutant evaluates null.length and throws.
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const declarator = {
          children: null,
          childCount: 0,
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
          children: [declCtx, { text: ';' }],
          childCount: 2,
        } as unknown as ParserRuleContext

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given NewExpressionContext with MethodCallExpression child, When entering LVDS, Then should NOT mutate (kills NewExpression → false mutant)', () => {
        // Arrange
        // The guard `if (initializer instanceof NewExpressionContext) { return }` with
        // the condition mutated to false would cause this constructor-with-method-arg to
        // be processed, and isMethodCall would return true (via child check), producing a
        // spurious mutation. The guard must remain to prevent this.
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const methodCallChild = {
          text: 'computeName()',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 13),
          childCount: 0,
          children: [],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(
          methodCallChild,
          MethodCallExpressionContext.prototype
        )

        const newExpr = {
          text: 'new Account(computeName())',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 26),
          childCount: 2,
          children: [methodCallChild],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(newExpr, NewExpressionContext.prototype)

        const ctx = createVariableDeclarationStatement(
          'Account',
          'acc',
          newExpr
        )

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert — constructor call must NOT be mutated even if it contains a method call
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given no enclosing method but class field exists with same name, When assigning method call, Then should NOT mutate (kills !methodName → false mutant)', () => {
        // Arrange
        // The guard `if (!methodName) { return }` with condition mutated to false would
        // let execution continue. resolveType(null, 'x') falls back to classFields.get('x')
        // which finds the type and would create a spurious mutation.
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map(),
          new Map([['x', 'integer']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getValue()')
        const assignCtx = createAssignExpression('x', methodCall)
        // No setEnclosingMethod — methodName will be null

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert — must return early at !methodName, not fall through to classField resolution
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given non-PRC RHS with MethodCallExpression child, When assigning to known variable, Then should NOT mutate (kills !(rhs instanceof PRC) → false mutant)', () => {
        // Arrange
        // The guard `if (!(rhs instanceof ParserRuleContext)) { return }` with condition
        // mutated to false would let a non-PRC rhs proceed to isMethodCall. If that rhs has
        // a children array containing a MethodCallExpressionContext, isMethodCall returns true
        // and a spurious mutation is created.
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['x', 'integer']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const methodCallChild = {
          text: 'getValue()',
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(
          methodCallChild,
          MethodCallExpressionContext.prototype
        )

        // Non-PRC node (does not extend ParserRuleContext) but has a MCEL child and
        // token positions so createMutationFromParserRuleContext would succeed if reached
        const nonPrcRhs = {
          text: 'getValue()',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 10),
          children: [methodCallChild],
        }

        const assignCtx = {
          childCount: 3,
          children: [{ text: 'x' }, { text: '=' }, nonPrcRhs],
          getChild: (i: number) => {
            if (i === 0) return { text: 'x' }
            if (i === 1) return { text: '=' }
            return nonPrcRhs
          },
        } as unknown as ParserRuleContext
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert — non-PRC rhs must be rejected before isMethodCall is invoked
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given non-PRC first child of outer ctx with valid declaration structure, When entering LVDS, Then should NOT mutate (kills !(declCtx instanceof PRC) → false mutant)', () => {
        // Arrange
        // The guard `if (!(declCtx instanceof ParserRuleContext)) { return }` with condition
        // mutated to false would proceed with a non-PRC declCtx. If that non-PRC declCtx has
        // children containing a declarators PRC with a method call, a spurious mutation is created.
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const methodCall = createMethodCallExpression('getValue()')
        const declarator = {
          text: 'x=getValue()',
          children: [{ text: 'x' }, { text: '=' }, methodCall],
          childCount: 3,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)

        const declarators = {
          text: 'x=getValue()',
          children: [declarator],
          childCount: 1,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarators, ParserRuleContext.prototype)

        // Non-PRC declCtx (does not extend ParserRuleContext) but has valid children
        const nonPrcDeclCtx = {
          children: [{ text: 'Integer' }, declarators],
          childCount: 2,
        }

        const ctx = {
          children: [nonPrcDeclCtx, { text: ';' }],
          childCount: 2,
        } as unknown as ParserRuleContext

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert — non-PRC declCtx must be rejected at the instanceof guard
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given non-PRC initializer with MethodCallExpression child, When entering LVDS, Then should NOT mutate (kills !(initializer instanceof PRC) → false mutant)', () => {
        // Arrange
        // The guard `if (!(initializer instanceof ParserRuleContext)) { return }` with
        // condition mutated to false would let a non-PRC initializer proceed. If it has a
        // children array with a MethodCallExpression, isMethodCall returns true and a
        // spurious mutation is created.
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const methodCallChild = {
          text: 'getValue()',
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(
          methodCallChild,
          MethodCallExpressionContext.prototype
        )

        // Non-PRC initializer (does not extend ParserRuleContext) with MCEL child
        const nonPrcInitializer = {
          text: 'getValue()',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 10),
          children: [methodCallChild],
          childCount: 1,
        }

        const declarator = {
          text: 'x=getValue()',
          children: [{ text: 'x' }, { text: '=' }, nonPrcInitializer],
          childCount: 3,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)

        const declarators = {
          text: 'x=getValue()',
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

        // Assert — non-PRC initializer must be rejected at the instanceof guard
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given non-PRC declarator child with method call structure, When entering LVDS, Then should NOT mutate (kills declarator instanceof PRC → true mutant)', () => {
        // Arrange
        // The condition `if (declarator instanceof ParserRuleContext)` with ConditionalExpression
        // mutated to true would call processVariableDeclarator on a non-PRC declarator.
        // If that non-PRC declarator has the structure of a valid declarator with a MCEL
        // initializer, a spurious mutation is created.
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const methodCall = createMethodCallExpression('getValue()')

        // Non-PRC declarator with full method-call-declarator structure
        const nonPrcDeclarator = {
          text: 'y=getValue()',
          children: [{ text: 'y' }, { text: '=' }, methodCall],
          childCount: 3,
        }

        const declarators = {
          text: 'y=getValue()',
          children: [nonPrcDeclarator],
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

        // Assert — non-PRC declarator must be skipped in the loop
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given ctx with exactly 1 child (no semicolon) that IS a valid PRC with method call, When entering LVDS, Then should mutate (kills length < 1 → <= 1 and < 2)', () => {
        // Arrange
        // The guard `ctx.children.length < 1` with `<= 1` or `< 2` mutant:
        // length=1 → 1 <= 1 (true) or 1 < 2 (true) → returns early → no mutation.
        // Original: 1 < 1 = false → proceeds → processes → creates mutation.
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const methodCall = createMethodCallExpression('getValue()')
        const declarator = {
          text: 'x=getValue()',
          children: [{ text: 'x' }, { text: '=' }, methodCall],
          childCount: 3,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)

        const declarators = {
          text: 'x=getValue()',
          children: [declarator],
          childCount: 1,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarators, ParserRuleContext.prototype)

        const declCtx = {
          children: [{ text: 'Integer' }, declarators],
          childCount: 2,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declCtx, ParserRuleContext.prototype)

        // Only 1 child (no semicolon) — this is the key: length === 1
        const ctx = {
          children: [declCtx],
          childCount: 1,
        } as unknown as ParserRuleContext

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert — original: 1 < 1 = false → proceeds → 1 mutation
        // Mutants `<= 1` and `< 2`: return early → 0 mutations
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })

      it('Given List<String>[] type (both list prefix AND array suffix), When entering statement, Then should mutate with List<List<String>>() (kills inner endsWith([]) → false)', () => {
        // Arrange — exercises the inner `if (lowerType.endsWith('[]'))` branch when the outer
        // `startsWith('list<')` is also true. If the inner check is mutated to false, the code
        // falls to `return \`new ${typeName}()\`` giving 'new List<String>[]()' instead of
        // 'new List<List<String>>()'.
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getMatrix()')
        const ctx = createVariableDeclarationStatement(
          'List<String>[]',
          'matrix',
          methodCall
        )

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert — inner endsWith('[]') = true → elementType = 'List<String>' → 'new List<List<String>>()'
        // With inner check → false: returns 'new List<String>[]()' (using typeName directly) → test fails → kills mutant
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('new List<List<String>>()')
      })

      it('Given non-PRC declarators WITH children array containing method call, When entering LVDS, Then should NOT mutate (kills !(declarators instanceof PRC) → false)', () => {
        // Arrange
        // The guard `!(declarators instanceof PRC) || !declarators.children` with
        // !(declarators instanceof PRC) → false becomes `false || !declarators.children`.
        // When declarators is non-PRC but HAS children: `!children` = false → doesn't return
        // → iterates children → processes method call → spurious mutation.
        // Original: `!(non-PRC) = true || ...` = true → returns early → no mutation.
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const methodCall = createMethodCallExpression('getValue()')
        const declarator = {
          text: 'x=getValue()',
          children: [{ text: 'x' }, { text: '=' }, methodCall],
          childCount: 3,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)

        // Non-PRC declarators WITH children (not extending ParserRuleContext)
        const nonPrcDeclarators = {
          text: 'x=getValue()',
          children: [declarator],
          childCount: 1,
        }

        const declCtx = {
          children: [{ text: 'Integer' }, nonPrcDeclarators],
          childCount: 2,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declCtx, ParserRuleContext.prototype)

        const ctx = {
          children: [declCtx, { text: ';' }],
          childCount: 2,
        } as unknown as ParserRuleContext

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert — non-PRC declarators must be rejected at the instanceof guard
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given declarator with 4 children including = sign, When entering LVDS, Then should mutate (kills length < 3 → != 3)', () => {
        // Arrange
        // The guard `ctx.children.length < 3` with `!= 3` mutant in processVariableDeclarator:
        // length=4 → 4 != 3 (true) → returns early → no mutation.
        // Original: 4 < 3 = false → proceeds → finds '=' at index 2 → processes → mutation.
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        const methodCall = createMethodCallExpression('getValue()')

        // 4-child declarator: [annotation, varName, '=', methodCall]
        const declarator = {
          text: 'x=getValue()',
          children: [
            { text: '@Annotation' },
            { text: 'x' },
            { text: '=' },
            methodCall,
          ],
          childCount: 4,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)

        const declarators = {
          text: 'x=getValue()',
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

        // Assert — original: 4 < 3 = false → proceeds → finds '=' at index 2 → mutates
        // Mutant `!= 3`: 4 != 3 = true → returns early → no mutation
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })

      it('Given wrapper expression with null children that is not MCEL or DEC, When entering LVDS, Then should not mutate (kills if(node.children) → if(true) in isMethodCall)', () => {
        // Arrange
        // In isMethodCall: `if (node.children)` with → `if (true)` mutant:
        // for a non-MCEL/DEC node with children=null, original skips the loop (falsy null).
        // Mutant enters `for (null)` → TypeError → test fails → mutant killed.
        // Original: null check → skips loop → returns false → no mutation.
        const typeRegistry = createTypeRegistryWithVars('testMethod', new Map())
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []

        // Plain PRC node (not MCEL, not DEC) with children = null
        const wrapperExpression = {
          text: 'x',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 1),
          childCount: 0,
          children: null,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(wrapperExpression, ParserRuleContext.prototype)

        const ctx = createVariableDeclarationStatement(
          'Integer',
          'y',
          wrapperExpression
        )

        // Act
        sut.enterLocalVariableDeclarationStatement(ctx)

        // Assert — no mutation: isMethodCall returns false since neither MCEL/DEC nor method-call children
        expect(sut._mutations).toHaveLength(0)
      })

      it('Given assign expression with childCount=2, When entering, Then should not mutate (kills != 3 → > 3 — childCount=2 proceeds with mutant but getChild(2) is undefined)', () => {
        // Arrange
        // The guard `ctx.childCount !== 3` with `> 3` mutant:
        // childCount=2 → 2 > 3 = false → doesn't return → proceeds.
        // getChild(2) returns undefined (no such child) → not PRC → returns early.
        // Original: 2 != 3 = true → returns early immediately.
        // With `> 3`: getChild(2) must be undefined or non-PRC so no mutation is created.
        // This confirms != 3 is the correct guard (not > 3 which would let childCount=2 through).
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['x', 'integer']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getValue()')
        const ctx = {
          childCount: 2,
          children: [{ text: 'x' }, { text: '=' }],
          getChild: (i: number) => {
            if (i === 0) return { text: 'x' }
            return { text: '=' }
          },
        } as unknown as ParserRuleContext
        setEnclosingMethod(ctx, 'testMethod')

        // Act
        sut.enterAssignExpression(ctx)

        // Assert — original: 2 != 3 = true → returns early → no mutation
        expect(sut._mutations).toHaveLength(0)
        void methodCall
      })

      it('Given assign expression with childCount=4, When entering, Then should not mutate (kills != 3 → < 3 and <= 2)', () => {
        // Arrange
        // The guard `ctx.childCount !== 3` with `< 3` mutant:
        // childCount=4 → 4 < 3 = false → doesn't return → proceeds through all checks → creates mutation.
        // Original: 4 != 3 = true → returns early → no mutation.
        // Similarly `<= 2`: 4 <= 2 = false → same behavior as `< 3`.
        // getChild(2) must be a valid method-call PRC so that the mutant fully reaches createMutation.
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['x', 'integer']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        // methodCall at getChild(2) so mutant `< 3` would reach isMethodCall(rhs) check
        const methodCall = createMethodCallExpression('getValue()')

        const ctx = {
          childCount: 4,
          children: [
            { text: 'x' },
            { text: '=' },
            methodCall,
            { text: 'extra' },
          ],
          getChild: (i: number) => {
            if (i === 0) return { text: 'x' }
            if (i === 2) return methodCall
            return { text: '' }
          },
        } as unknown as ParserRuleContext
        setEnclosingMethod(ctx, 'testMethod')

        // Act
        sut.enterAssignExpression(ctx)

        // Assert — original: 4 != 3 = true → returns early → no mutation
        // Mutant `< 3`: 4 < 3 = false → proceeds → x is a known integer → creates mutation → test fails
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('generateDefaultValue boundary conditions', () => {
      it('Given List<String>[] type via enterAssignExpression, When assigning method call, Then replaces with new List<List<String>>() (kills inner endsWith([]) → false)', () => {
        // Arrange — exercises both outer startsWith('list<') AND inner endsWith('[]') simultaneously.
        // If the inner `endsWith('[]')` check is mutated to false, the code takes
        // `return \`new ${typeName}()\`` = 'new List<String>[]()' instead of
        // `return \`new List<${elementType}>()\`` = 'new List<List<String>>()'.
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['matrix', 'List<String>[]']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getMatrix()')
        const assignCtx = createAssignExpression('matrix', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert — inner endsWith('[]') = true takes precedence:
        // elementType = 'List<String>[]'.slice(0,-2) = 'List<String>' → 'new List<List<String>>()'
        // With inner check → false: returns 'new List<String>[]()' → test fails → kills mutant
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('new List<List<String>>()')
      })

      it('Given String type stored as uppercase via enterAssignExpression, When assigning, Then replaces with empty string (kills toLowerCase() removal)', () => {
        // Arrange — exercises the `lowerType = typeName.toLowerCase()` step.
        // TypeRegistry stores the variable type as 'String' (PascalCase).
        // generateDefaultValue receives 'String', lowercases to 'string', finds in defaultValues.
        // If toLowerCase() is removed: 'String'.startsWith('list<') = false → not list/set/map →
        // defaultValues['String'] = undefined (key 'string' exists, not 'String') → returns 'null'.
        // Test asserts '' → fails with mutation → kills it.
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['label', 'String']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getLabel()')
        const assignCtx = createAssignExpression('label', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert — toLowerCase makes 'String' → 'string' → defaultValues['string'] = "''"
        // Without toLowerCase: defaultValues['String'] = undefined → returns 'null' → test fails
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })

      it('Given Integer type stored as PascalCase via enterAssignExpression, When assigning, Then replaces with 0 (kills toLowerCase() removal for numeric types)', () => {
        // Arrange — same as above but for numeric type.
        // TypeRegistry stores 'Integer' (PascalCase). generateDefaultValue lowercases to 'integer'.
        // Without toLowerCase: defaultValues['Integer'] = undefined → returns 'null' not '0'.
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['count', 'Integer']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('getCount()')
        const assignCtx = createAssignExpression('count', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert — toLowerCase makes 'Integer' → 'integer' → returns '0'
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })

      it('Given List<String> type stored as PascalCase via enterAssignExpression, When assigning, Then replaces with new List<String>() (kills toLowerCase() removal for collection types)', () => {
        // Arrange — TypeRegistry stores 'List<String>'. generateDefaultValue lowercases to 'list<string>'.
        // Without toLowerCase: 'List<String>'.startsWith('list<') = false (capital L) → falls to set/map →
        // also false → defaultValues lookup: 'List<String>' not a key → returns 'null' not list constructor.
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['items', 'List<String>']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('fetchItems()')
        const assignCtx = createAssignExpression('items', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert — toLowerCase('List<String>') = 'list<string>' → startsWith('list<') = true → 'new List<String>()'
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('new List<String>()')
      })

      it('Given String[] type stored as-is via enterAssignExpression, When assigning, Then replaces with new List<String>() (kills endsWith([]) check specifically)', () => {
        // Arrange — tests the endsWith('[]') branch of generateDefaultValue when invoked through
        // the enterAssignExpression → resolveVariable → generateDefaultValue path.
        // Specifically: 'String[]' lowercased is 'string[]', which does NOT startWith 'list<' but
        // DOES endWith '[]' — so it enters via the second condition of the outer OR.
        // This kills mutations where `|| lowerType.endsWith('[]')` is removed (replaced by false):
        // 'string[]' wouldn't enter the block → falls through → defaultValues['string[]'] = undefined → 'null'.
        const typeRegistry = createTypeRegistryWithVars(
          'testMethod',
          new Map([['arr', 'String[]']])
        )
        const sut = new NonVoidMethodCallMutator(typeRegistry)
        sut._mutations = []
        const methodCall = createMethodCallExpression('fetchArr()')
        const assignCtx = createAssignExpression('arr', methodCall)
        setEnclosingMethod(assignCtx, 'testMethod')

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert — endsWith('[]') triggers → elementType = 'String' → 'new List<String>()'
        // Without endsWith check: 'null' → test fails → kills mutant
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('new List<String>()')
      })
    })
  })
})
