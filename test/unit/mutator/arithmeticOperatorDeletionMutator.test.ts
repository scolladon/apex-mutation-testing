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
        getChild: vi.fn().mockReturnValue({}),
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

  describe('Given identity element operands', () => {
    it('Then should not generate a + 0 → a (equivalent: a + 0 = a)', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '+', '0', 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert — only the non-equivalent mutation (→ 0) should be generated
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('0')
    })

    it('Then should not generate 0 + b → b (equivalent: 0 + b = b)', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('0', '+', 'b', 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert — only the non-equivalent mutation (→ 0) should be generated
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('0')
    })

    it('Then should not generate a - 0 → a (equivalent: a - 0 = a)', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '-', '0', 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert — only the non-equivalent mutation (→ 0) should be generated
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('0')
    })

    it('Then should generate 0 - b → 0 and 0 - b → b (0 - b ≠ b so both are non-equivalent)', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('0', '-', 'b', 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert — both mutations generated since neither is equivalent
      expect(sut._mutations).toHaveLength(2)
    })

    it('Then should not generate a * 1 → a (equivalent: a * 1 = a)', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '*', '1', 'testMethod')

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert — only the non-equivalent mutation (→ 1) should be generated
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('1')
    })

    it('Then should not generate 1 * b → b (equivalent: 1 * b = b)', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('1', '*', 'b', 'testMethod')

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert — only the non-equivalent mutation (→ 1) should be generated
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('1')
    })

    it('Then should not generate a / 1 → a (equivalent: a / 1 = a)', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '/', '1', 'testMethod')

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert — only the non-equivalent mutation (→ 1) should be generated
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('1')
    })

    it('Then should generate 1 / b → 1 and 1 / b → b (1 / b ≠ b so both are non-equivalent)', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('1', '/', 'b', 'testMethod')

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert — both mutations generated since 1 / b ≠ b in general
      expect(sut._mutations).toHaveLength(2)
    })
  })

  describe('Given identity elements with Long and float suffixes', () => {
    it.each([
      { right: '0L', description: 'Long zero' },
      { right: '0l', description: 'long zero lowercase' },
      { right: '0.0', description: 'float zero' },
      { right: '0.00', description: 'float multi-zero' },
      { right: '0.0d', description: 'double zero lowercase d' },
      { right: '0.0D', description: 'double zero uppercase D' },
      { right: '0.0f', description: 'float zero lowercase f' },
      { right: '0.0F', description: 'float zero uppercase F' },
    ])('Then should NOT generate right mutation for a + $description (equivalent)', ({
      right,
    }) => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '+', right, 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert — right identity for + means a + 0 = a, so only left mutation (→ right) skipped
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe(right)
    })

    it.each([
      { right: '1L', description: 'Long one' },
      { right: '1l', description: 'long one lowercase' },
      { right: '1.0', description: 'float one' },
      { right: '1.00', description: 'float multi-one' },
      { right: '1.0d', description: 'double one lowercase d' },
      { right: '1.0D', description: 'double one uppercase D' },
      { right: '1.0f', description: 'float one lowercase f' },
      { right: '1.0F', description: 'float one uppercase F' },
    ])('Then should NOT generate right mutation for a * $description (equivalent)', ({
      right,
    }) => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '*', right, 'testMethod')

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe(right)
    })

    it.each([
      { left: '0L', description: 'Long zero uppercase L' },
      { left: '0l', description: 'long zero lowercase l' },
      { left: '0.0', description: 'float zero' },
      { left: '0.00', description: 'float multi-zero' },
      { left: '0.0d', description: 'double zero lowercase d' },
      { left: '0.0D', description: 'double zero uppercase D' },
      { left: '0.0f', description: 'float zero lowercase f' },
      { left: '0.0F', description: 'float zero uppercase F' },
    ])('Then should NOT generate left mutation for $description + b (equivalent)', ({
      left,
    }) => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod(left, '+', 'b', 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert — left identity for + means 0 + b = b
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe(left)
    })

    it.each([
      { left: '1L', description: 'Long one uppercase L' },
      { left: '1l', description: 'long one lowercase l' },
      { left: '1.0', description: 'float one' },
      { left: '1.00', description: 'float multi-one' },
      { left: '1.0d', description: 'double one lowercase d' },
      { left: '1.0D', description: 'double one uppercase D' },
      { left: '1.0f', description: 'float one lowercase f' },
      { left: '1.0F', description: 'float one uppercase F' },
    ])('Then should NOT generate left mutation for $description * b (equivalent)', ({
      left,
    }) => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod(left, '*', 'b', 'testMethod')

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe(left)
    })

    it('Then should generate mutations for a - 0L (0 right not identity for -)', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '-', '0L', 'testMethod')

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert — a - 0L = a, so right is identity, only one mutation
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('0L')
    })

    it('Then should generate mutations for a / 1L (1 right is identity for /)', () => {
      // Arrange
      const typeRegistry = createTypeRegistry()
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      const ctx = createArithmeticCtxInMethod('a', '/', '1L', 'testMethod')

      // Act
      sut.enterArth1Expression(ctx as unknown as Arth1ExpressionContext)

      // Assert — a / 1L = a, right is identity
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('1L')
    })
  })

  describe('Given no enclosing method', () => {
    it('Then should allow mutation for + when no method context exists', () => {
      // Arrange
      const typeRegistry = createTypeRegistry(new Map())
      const sut = new ArithmeticOperatorDeletionMutator(typeRegistry)
      // ctx has start/stop tokens but no parent => getEnclosingMethodName returns null => falls through to allow mutation
      const operatorNode = new TerminalNode({ text: '+' } as Token)
      const leftNode = { text: 'a' }
      const rightNode = { text: 'b' }
      const ctx = {
        childCount: 3,
        text: 'a+b',
        start: TestUtil.createToken(1, 0),
        stop: TestUtil.createToken(1, 2),
        children: [leftNode, operatorNode, rightNode],
        getChild: (index: number) => {
          if (index === 0) return leftNode
          if (index === 1) return operatorNode
          return rightNode
        },
      } as unknown as ParserRuleContext

      // Act
      sut.enterArth2Expression(ctx as unknown as Arth2ExpressionContext)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })
  })
})
