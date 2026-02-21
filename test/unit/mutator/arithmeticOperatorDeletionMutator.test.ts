import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import {
  Arth1ExpressionContext,
  Arth2ExpressionContext,
  AssignExpressionContext,
  MethodDeclarationContext,
} from 'apex-parser'
import { ArithmeticOperatorDeletionMutator } from '../../../src/mutator/arithmeticOperatorDeletionMutator.js'
import type { TypeMatcher } from '../../../src/service/typeMatcher.js'
import {
  APEX_TYPE,
  ApexMethod,
  ApexType,
} from '../../../src/type/ApexMethod.js'
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

function createArithmeticCtxInMethod(
  leftText: string,
  op: string,
  rightText: string,
  methodName: string
): ParserRuleContext {
  const operatorNode = new TerminalNode({ text: op } as Token)
  const leftNode = { text: leftText }
  const rightNode = { text: rightText }
  const ctx = {
    childCount: 3,
    text: `${leftText}${op}${rightText}`,
    start: TestUtil.createToken(1, 0),
    stop: TestUtil.createToken(
      1,
      leftText.length + op.length + rightText.length
    ),
    children: [leftNode, operatorNode, rightNode],
    getChild: (index: number) => {
      if (index === 0) return leftNode
      if (index === 1) return operatorNode
      return rightNode
    },
  } as unknown as ParserRuleContext

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
  return ctx
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

describe('ArithmeticOperatorDeletionMutator', () => {
  describe('Given an addition expression (a + b)', () => {
    it('Then should create 2 mutations: first operand and second operand', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '+', 'b', 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
      expect(sut._mutations[0].replacement).toBe('a')
      expect(sut._mutations[1].replacement).toBe('b')
    })
  })

  describe('Given a subtraction expression (a - b)', () => {
    it('Then should create 2 mutations: first operand and second operand', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '-', 'b', 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
      expect(sut._mutations[0].replacement).toBe('a')
      expect(sut._mutations[1].replacement).toBe('b')
    })
  })

  describe('Given a multiplication expression (a * b)', () => {
    it('Then should create 2 mutations: first operand and second operand', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '*', 'b', 'testMethod')

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
      expect(sut._mutations[0].replacement).toBe('a')
      expect(sut._mutations[1].replacement).toBe('b')
    })
  })

  describe('Given a division expression (a / b)', () => {
    it('Then should create 2 mutations: first operand and second operand', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '/', 'b', 'testMethod')

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
      expect(sut._mutations[0].replacement).toBe('a')
      expect(sut._mutations[1].replacement).toBe('b')
    })
  })

  describe('Given an expression with insufficient children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const sut = new ArithmeticOperatorDeletionMutator()
      const ctx = { childCount: 2 } as unknown as ParserRuleContext

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given an expression where operator is not a TerminalNode', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const sut = new ArithmeticOperatorDeletionMutator()
      const ctx = {
        childCount: 3,
        getChild: () => ({}),
      } as unknown as ParserRuleContext

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given an expression with non-arithmetic operator', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const sut = new ArithmeticOperatorDeletionMutator()
      const ctx = createArithmeticCtxInMethod('a', '==', 'b', 'testMethod')

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given string literal operands with + operator', () => {
    it('Then should NOT mutate string concatenation', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod(
        "'hello'",
        '+',
        "'world'",
        'testMethod'
      )

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given string variable operands with + operator', () => {
    it('Then should NOT mutate when tracked variable is String', () => {
      // Arrange
      const variableScopes = new Map([
        ['testMethod', new Map([['name', 'string']])],
      ])
      const typeRegistry = createTypeRegistry(new Map(), variableScopes)
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod(
        'name',
        '+',
        'suffix',
        'testMethod'
      )

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given numeric variable operands with + operator', () => {
    it('Then should create mutations', () => {
      // Arrange
      const variableScopes = new Map([
        [
          'testMethod',
          new Map([
            ['a', 'integer'],
            ['b', 'integer'],
          ]),
        ],
      ])
      const typeRegistry = createTypeRegistry(new Map(), variableScopes)
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '+', 'b', 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })
  })

  describe('Given numeric literals', () => {
    it('Then should create mutations for 1 + 2', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('1', '+', '2', 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
      expect(sut._mutations[0].replacement).toBe('1')
      expect(sut._mutations[1].replacement).toBe('2')
    })
  })

  describe('Given method returning String with + operator', () => {
    it('Then should NOT mutate', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('getName', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod(
        'getName()',
        '+',
        'x',
        'testMethod'
      )

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given -, *, / operators', () => {
    it('Then should always generate mutations for - regardless of operand types', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '-', 'b', 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })

    it('Then should always generate mutations for * regardless of operand types', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '*', 'b', 'testMethod')

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })

    it('Then should always generate mutations for / regardless of operand types', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '/', 'b', 'testMethod')

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })
  })

  describe('Given class field tracking', () => {
    it('Then should NOT mutate + when class-level String field is used', () => {
      // Arrange
      const classFields = new Map([['label', 'string']])
      const typeRegistry = createTypeRegistry(new Map(), new Map(), classFields)
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod(
        'label',
        '+',
        'suffix',
        'testMethod'
      )

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given scope isolation', () => {
    it('Then String variable in method A should not affect method B', () => {
      // Arrange
      const variableScopes = new Map([
        ['methodA', new Map([['name', 'string']])],
      ])
      const typeRegistry = createTypeRegistry(new Map(), variableScopes)
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('name', '+', 'other', 'methodB')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })
  })

  describe('Given formal parameter tracking', () => {
    it('Then should NOT mutate + when parameter is String type', () => {
      // Arrange
      const variableScopes = new Map([
        ['testMethod', new Map([['input', 'string']])],
      ])
      const typeRegistry = createTypeRegistry(new Map(), variableScopes)
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod(
        'input',
        '+',
        'suffix',
        'testMethod'
      )

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given enhanced for control tracking', () => {
    it('Then should NOT mutate + when loop variable is String type', () => {
      // Arrange
      const variableScopes = new Map([
        ['testMethod', new Map([['item', 'string']])],
      ])
      const typeRegistry = createTypeRegistry(new Map(), variableScopes)
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod(
        'item',
        '+',
        'suffix',
        'testMethod'
      )

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given mutations metadata', () => {
    it('Then mutationName should be ArithmeticOperatorDeletionMutator', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '+', 'b', 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
      sut._mutations.forEach(mutation => {
        expect(mutation.mutationName).toBe('ArithmeticOperatorDeletionMutator')
      })
    })
  })

  describe('Given enterAssignExpression', () => {
    it('Then should not directly create mutations', () => {
      // Arrange
      const sut = new ArithmeticOperatorDeletionMutator()
      const ctx = {
        childCount: 3,
        getChild: jest.fn().mockReturnValue({}),
      } as unknown as ParserRuleContext

      // Act
      sut.enterAssignExpression(ctx as unknown as AssignExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given field access operands with sObject matcher', () => {
    it('Then should NOT mutate + when sObject field is non-numeric (acc.Name)', () => {
      // Arrange
      const variableScopes = new Map([
        ['testMethod', new Map([['acc', 'account']])],
      ])
      const fieldMap = new Map([
        [
          'account',
          new Map<string, ApexType>([
            ['name', APEX_TYPE.STRING],
            ['numberofemployees', APEX_TYPE.INTEGER],
          ]),
        ],
      ])
      const matcher = createSObjectFieldMatcher(new Set(['account']), fieldMap)
      const typeRegistry = createTypeRegistry(
        new Map(),
        variableScopes,
        new Map(),
        [matcher]
      )
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod(
        'acc.Name',
        '+',
        '5',
        'testMethod'
      )

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Then should mutate + when sObject field is numeric (acc.NumberOfEmployees)', () => {
      // Arrange
      const variableScopes = new Map([
        ['testMethod', new Map([['acc', 'account']])],
      ])
      const fieldMap = new Map([
        [
          'account',
          new Map<string, ApexType>([
            ['name', APEX_TYPE.STRING],
            ['numberofemployees', APEX_TYPE.INTEGER],
          ]),
        ],
      ])
      const matcher = createSObjectFieldMatcher(new Set(['account']), fieldMap)
      const typeRegistry = createTypeRegistry(
        new Map(),
        variableScopes,
        new Map(),
        [matcher]
      )
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod(
        'acc.NumberOfEmployees',
        '+',
        '5',
        'testMethod'
      )

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })
  })

  describe('Given field access operands without sObject matcher', () => {
    it('Then should NOT mutate + when dotted expression cannot be resolved', () => {
      // Arrange
      const variableScopes = new Map([
        ['testMethod', new Map([['obj', 'myobject']])],
      ])
      const typeRegistry = createTypeRegistry(new Map(), variableScopes)
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod(
        'obj.field',
        '+',
        'x',
        'testMethod'
      )

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })
  })

  describe('Given expression without start/stop tokens', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const operatorNode = new TerminalNode({ text: '+' } as Token)
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      const ctx = {
        childCount: 3,
        getChild: (index: number) => {
          if (index === 0) return { text: 'a' }
          if (index === 1) return operatorNode
          return { text: 'b' }
        },
        start: null,
        stop: null,
        parent: methodCtx,
      } as unknown as ParserRuleContext

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given no TypeRegistry (non-type-aware mode)', () => {
    it('Then should create mutations for + without type checking', () => {
      // Arrange
      const sut = new ArithmeticOperatorDeletionMutator()
      const ctx = createArithmeticCtxInMethod('a', '+', 'b', 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })
  })
})
