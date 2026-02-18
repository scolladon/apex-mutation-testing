import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { MethodDeclarationContext } from 'apex-parser'
import { ArithmeticOperatorMutator } from '../../../src/mutator/arithmeticOperatorMutator.js'
import type { TypeMatcher } from '../../../src/service/typeMatcher.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'
import { TypeRegistry } from '../../../src/type/TypeRegistry.js'
import { TestUtil } from '../../utils/testUtil.js'

function createTypeRegistry(
  methodTypeTable: Map<string, ApexMethod>,
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
  const ctx = TestUtil.createArithmeticExpression(leftText, op, rightText)
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

describe('ArithmeticOperatorMutator', () => {
  describe('TypeRegistry path', () => {
    describe('Given basic arithmetic operators', () => {
      it('Then should mutate addition operator', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('a', '+', 'b', 'testMethod')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
        expect(sut._mutations[0].replacement).toBe('-')
        expect(sut._mutations[1].replacement).toBe('*')
        expect(sut._mutations[2].replacement).toBe('/')
      })

      it('Then should mutate subtraction operator', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('a', '-', 'b', 'testMethod')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
        expect(sut._mutations[0].replacement).toBe('+')
        expect(sut._mutations[1].replacement).toBe('*')
        expect(sut._mutations[2].replacement).toBe('/')
      })

      it('Then should mutate multiplication operator', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('a', '*', 'b', 'testMethod')

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
        expect(sut._mutations[0].replacement).toBe('+')
        expect(sut._mutations[1].replacement).toBe('-')
        expect(sut._mutations[2].replacement).toBe('/')
      })

      it('Then should mutate division operator', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('a', '/', 'b', 'testMethod')

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
        expect(sut._mutations[0].replacement).toBe('+')
        expect(sut._mutations[1].replacement).toBe('-')
        expect(sut._mutations[2].replacement).toBe('*')
      })
    })

    describe('Given non-arithmetic operators or edge cases', () => {
      it('Then should not mutate when child count is not 3', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = { childCount: 2 } as unknown as ParserRuleContext

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then should not mutate when terminal node is not found', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = {
          childCount: 3,
          getChild: jest.fn().mockReturnValue({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then should not mutate when operator is not in replacement map', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('a', '==', 'b', 'testMethod')

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then should not mutate non-arithmetic operators', () => {
        // Arrange
        const nonArithmeticOperators = [
          '==',
          '!=',
          '&&',
          '||',
          '>',
          '<',
          '>=',
          '<=',
        ]

        for (const operator of nonArithmeticOperators) {
          const typeRegistry = createTypeRegistry(new Map())
          const sut = new ArithmeticOperatorMutator(typeRegistry)
          const ctx = createArithmeticCtxInMethod(
            'a',
            operator,
            'b',
            'testMethod'
          )

          // Act
          sut.enterArth1Expression(ctx)
          sut.enterArth2Expression(ctx)

          // Assert
          expect(sut._mutations).toHaveLength(0)
        }
      })

      it('Then should handle edge case with null terminal node text', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const mockTerminalNode = new TerminalNode({
          text: null,
        } as unknown as Token)
        const ctx = {
          childCount: 3,
          getChild: jest.fn().mockImplementation(index => {
            if (index === 0) return { text: 'a' }
            if (index === 1) return mockTerminalNode
            return { text: 'b' }
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then should handle edge case with undefined terminal node text', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const mockTerminalNode = new TerminalNode({
          text: undefined,
        } as unknown as Token)
        const ctx = {
          childCount: 3,
          getChild: jest.fn().mockImplementation(index => {
            if (index === 0) return { text: 'a' }
            if (index === 1) return mockTerminalNode
            return { text: 'b' }
          }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('Given enterAssignExpression', () => {
      it('Then should have an enterAssignExpression method', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)

        // Assert
        expect(typeof sut.enterAssignExpression).toBe('function')
      })

      it('Then should not directly create mutations', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const assignCtx = {
          childCount: 3,
          getChild: jest.fn().mockReturnValue({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterAssignExpression(assignCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then should process arithmetic operations in assignment expressions via traversal', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const assignCtx = {
          childCount: 3,
          getChild: jest.fn().mockReturnValue({}),
        } as unknown as ParserRuleContext
        const arithmeticCtx = createArithmeticCtxInMethod(
          'a',
          '+',
          'b',
          'testMethod'
        )

        // Act
        sut.enterAssignExpression(assignCtx)
        sut.enterArth2Expression(arithmeticCtx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
        expect(sut._mutations[0].replacement).toBe('-')
      })
    })

    describe('Given multiple operators in sequence', () => {
      it('Then should generate mutations for each operator', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const firstCtx = createArithmeticCtxInMethod(
          'a',
          '+',
          'b',
          'testMethod'
        )
        const secondCtx = createArithmeticCtxInMethod(
          'a',
          '*',
          'b',
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(firstCtx)
        sut.enterArth1Expression(secondCtx)

        // Assert
        expect(sut._mutations).toHaveLength(6)
        expect(sut._mutations[0].replacement).toBe('-')
        expect(sut._mutations[1].replacement).toBe('*')
        expect(sut._mutations[2].replacement).toBe('/')
        expect(sut._mutations[3].replacement).toBe('+')
        expect(sut._mutations[4].replacement).toBe('-')
        expect(sut._mutations[5].replacement).toBe('/')
      })
    })

    describe('Given mutation naming', () => {
      it('Then should create mutations with correct mutator name', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('a', '+', 'b', 'testMethod')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
        for (const mutation of sut._mutations) {
          expect(mutation.mutationName).toBe('ArithmeticOperatorMutator')
        }
      })
    })

    describe('Given string literal operands', () => {
      it("Then should NOT mutate + when left operand is a string literal ('hello' + 'world')", () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          "'hello'",
          '+',
          "'world'",
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it("Then should NOT mutate + when right operand is a string literal (count + 'items')", () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          'count',
          '+',
          "'items'",
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('Given string variable operands', () => {
      it('Then should NOT mutate + when operand is a String variable', () => {
        // Arrange
        const variableScopes = new Map([
          ['testMethod', new Map([['name', 'string']])],
        ])
        const typeRegistry = createTypeRegistry(new Map(), variableScopes)
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          'name',
          '+',
          'suffix',
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('Given numeric operands', () => {
      it('Then should mutate + when operands are Integer variables', () => {
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
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('a', '+', 'b', 'testMethod')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
      })

      it('Then should mutate + for numeric literals (1 + 2)', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('1', '+', '2', 'testMethod')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
      })
    })

    describe('Given method return type detection', () => {
      it('Then should NOT mutate + when method call returns String', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('getName', {
          returnType: 'String',
          startLine: 1,
          endLine: 5,
          type: ApexType.STRING,
        })
        const typeRegistry = createTypeRegistry(typeTable)
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          'getName()',
          '+',
          'x',
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then should mutate + when method call returns Integer', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('getCount', {
          returnType: 'Integer',
          startLine: 1,
          endLine: 5,
          type: ApexType.INTEGER,
        })
        const typeRegistry = createTypeRegistry(typeTable)
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          'getCount()',
          '+',
          '1',
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
      })
    })

    describe('Given no type information available', () => {
      it('Then should default to generating mutations for +', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('a', '+', 'b', 'testMethod')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
      })
    })

    describe('Given -, *, / operators', () => {
      it('Then should always generate mutations for - regardless of operand types', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('a', '-', 'b', 'testMethod')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
      })

      it('Then should always generate mutations for * regardless of operand types', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('a', '*', 'b', 'testMethod')

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
      })

      it('Then should always generate mutations for / regardless of operand types', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('a', '/', 'b', 'testMethod')

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
      })
    })

    describe('Given class field tracking', () => {
      it('Then should NOT mutate + when class-level String field is used', () => {
        // Arrange
        const classFields = new Map([['label', 'string']])
        const typeRegistry = createTypeRegistry(
          new Map(),
          new Map(),
          classFields
        )
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          'label',
          '+',
          'suffix',
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

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
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('name', '+', 'other', 'methodB')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
      })
    })

    describe('Given formal parameter tracking', () => {
      it('Then should NOT mutate + when parameter is String type', () => {
        // Arrange
        const variableScopes = new Map([
          ['testMethod', new Map([['input', 'string']])],
        ])
        const typeRegistry = createTypeRegistry(new Map(), variableScopes)
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          'input',
          '+',
          'suffix',
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

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
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          'item',
          '+',
          'suffix',
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

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
            new Map([
              ['name', ApexType.STRING],
              ['numberofemployees', ApexType.INTEGER],
            ]),
          ],
        ])
        const matcher = createSObjectFieldMatcher(
          new Set(['account']),
          fieldMap
        )
        const typeRegistry = createTypeRegistry(
          new Map(),
          variableScopes,
          new Map(),
          [matcher]
        )
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          'acc.Name',
          '+',
          '5',
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

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
            new Map([
              ['name', ApexType.STRING],
              ['numberofemployees', ApexType.INTEGER],
            ]),
          ],
        ])
        const matcher = createSObjectFieldMatcher(
          new Set(['account']),
          fieldMap
        )
        const typeRegistry = createTypeRegistry(
          new Map(),
          variableScopes,
          new Map(),
          [matcher]
        )
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          'acc.NumberOfEmployees',
          '+',
          '5',
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
      })

      it('Then should allow mutation when sObject field type is unknown', () => {
        // Arrange
        const variableScopes = new Map([
          ['testMethod', new Map([['acc', 'account']])],
        ])
        const fieldMap = new Map([['account', new Map<string, ApexType>()]])
        const matcher = createSObjectFieldMatcher(
          new Set(['account']),
          fieldMap
        )
        const typeRegistry = createTypeRegistry(
          new Map(),
          variableScopes,
          new Map(),
          [matcher]
        )
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          'acc.UnknownField',
          '+',
          '5',
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        // TypeRegistry returns null for unresolved dotted expressions, so mutation is allowed
        expect(sut._mutations).toHaveLength(3)
      })
    })

    describe('Given field access operands without sObject matcher', () => {
      it('Then should allow mutation when root type cannot be resolved via matcher', () => {
        // Arrange
        const variableScopes = new Map([
          ['testMethod', new Map([['obj', 'myobject']])],
        ])
        const typeRegistry = createTypeRegistry(new Map(), variableScopes)
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          'obj.field',
          '+',
          'x',
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        // TypeRegistry returns null for dotted expressions without a matching field type resolver
        expect(sut._mutations).toHaveLength(3)
      })
    })

    describe('Given compound sub-expression operands', () => {
      it('Then should NOT mutate + when left operand contains a string literal', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          "acc.Name+' has '",
          '+',
          'count',
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then should NOT mutate + when right operand contains a string literal', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          'total',
          '+',
          "count+' items'",
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('Given unknown method call in type table', () => {
      it('Then should mutate + when method call is not in type table', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod(
          'unknownMethod()',
          '+',
          'x',
          'testMethod'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
      })
    })

    describe('Given unknown type variable', () => {
      it('Then should resolve unknown type and allow mutation', () => {
        // Arrange
        const variableScopes = new Map([
          ['testMethod', new Map([['acc', 'account']])],
        ])
        const typeRegistry = createTypeRegistry(new Map(), variableScopes)
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        const ctx = createArithmeticCtxInMethod('acc', '+', 'x', 'testMethod')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        // TypeRegistry classifies 'account' as VOID (unrecognized type without matcher), which is not numeric
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('Given no enclosing method', () => {
      it('Then should allow mutation for + when no method context exists', () => {
        // Arrange
        const typeRegistry = createTypeRegistry(new Map())
        const sut = new ArithmeticOperatorMutator(typeRegistry)
        // No parent => getEnclosingMethodName returns null => falls through to allow mutation
        const ctx = TestUtil.createArithmeticExpression('a', '+', 'b')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        // When no method name is found, string literal check still runs,
        // but TypeRegistry path skips (methodName is null), so mutation is allowed
        expect(sut._mutations).toHaveLength(3)
      })
    })
  })

  describe('backward compatibility (legacy TypeTrackingBaseListener path)', () => {
    it('Then should mutate addition operator without TypeRegistry', () => {
      // Arrange
      const sut = new ArithmeticOperatorMutator()
      const mockTerminalNode = new TerminalNode({ text: '+' } as Token)
      const mockCtx = {
        childCount: 3,
        getChild: jest.fn().mockImplementation(index => {
          if (index === 0) return { text: 'a' }
          if (index === 1) return mockTerminalNode
          return { text: 'b' }
        }),
      } as unknown as ParserRuleContext

      // Act
      sut.enterArth2Expression(mockCtx)

      // Assert
      expect(sut._mutations).toHaveLength(3)
      expect(sut._mutations[0].replacement).toBe('-')
      expect(sut._mutations[1].replacement).toBe('*')
      expect(sut._mutations[2].replacement).toBe('/')
    })

    it('Then should NOT mutate + when operand is a tracked String variable via legacy path', () => {
      // Arrange
      const sut = new ArithmeticOperatorMutator()
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varDecl = TestUtil.createLocalVariableDeclaration('String', 'name')
      sut.enterLocalVariableDeclaration(varDecl)

      const ctx = TestUtil.createArithmeticExpression('name', '+', 'suffix')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Then should mutate + when operands are tracked Integer variables via legacy path', () => {
      // Arrange
      const sut = new ArithmeticOperatorMutator()
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varDeclA = TestUtil.createLocalVariableDeclaration('Integer', 'a')
      sut.enterLocalVariableDeclaration(varDeclA)

      const varDeclB = TestUtil.createLocalVariableDeclaration('Integer', 'b')
      sut.enterLocalVariableDeclaration(varDeclB)

      const ctx = TestUtil.createArithmeticExpression('a', '+', 'b')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(3)
    })

    it('Then should NOT mutate + when method call returns String via legacy typeTable', () => {
      // Arrange
      const sut = new ArithmeticOperatorMutator()
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('getName', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })
      sut.setTypeTable(typeTable)

      const ctx = TestUtil.createArithmeticExpression('getName()', '+', 'x')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Then should NOT mutate + when class-level String field is used via legacy path', () => {
      // Arrange
      const sut = new ArithmeticOperatorMutator()
      const fieldDecl = TestUtil.createFieldDeclaration('String', 'label')
      sut.enterFieldDeclaration(fieldDecl)

      const ctx = TestUtil.createArithmeticExpression('label', '+', 'suffix')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Then String variable in method A should not affect method B via legacy path', () => {
      // Arrange
      const sut = new ArithmeticOperatorMutator()
      const methodACtx = TestUtil.createMethodDeclaration('void', 'methodA')
      sut.enterMethodDeclaration(methodACtx)

      const varDecl = TestUtil.createLocalVariableDeclaration('String', 'name')
      sut.enterLocalVariableDeclaration(varDecl)

      sut.exitMethodDeclaration()

      const methodBCtx = TestUtil.createMethodDeclaration('void', 'methodB')
      sut.enterMethodDeclaration(methodBCtx)

      const ctx = TestUtil.createArithmeticExpression('name', '+', 'other')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(3)
    })

    it('Then should NOT mutate + when parameter is String type via legacy path', () => {
      // Arrange
      const sut = new ArithmeticOperatorMutator()
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const paramCtx = TestUtil.createFormalParameter('String', 'input')
      sut.enterFormalParameter(paramCtx)

      const ctx = TestUtil.createArithmeticExpression('input', '+', 'suffix')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Then should NOT mutate + when loop variable is String type via legacy path', () => {
      // Arrange
      const sut = new ArithmeticOperatorMutator()
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const forCtx = TestUtil.createEnhancedForControl('String', 'item')
      sut.enterEnhancedForControl(forCtx)

      const ctx = TestUtil.createArithmeticExpression('item', '+', 'suffix')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    describe('Given field access operands with sObject describe data via legacy path', () => {
      let mockRepository: {
        isSObject: jest.Mock
        resolveFieldType: jest.Mock
        describe: jest.Mock
      }
      let sut: ArithmeticOperatorMutator

      beforeEach(() => {
        sut = new ArithmeticOperatorMutator()
        mockRepository = {
          isSObject: jest.fn(),
          resolveFieldType: jest.fn(),
          describe: jest.fn(),
        }
        sut.setSObjectDescribeRepository(
          mockRepository as unknown as import('../../../src/adapter/sObjectDescribeRepository.js').SObjectDescribeRepository
        )
      })

      it('Then should NOT mutate + when sObject field is non-numeric (acc.Name)', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'Account',
          'acc'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        mockRepository.isSObject.mockReturnValue(true)
        mockRepository.resolveFieldType.mockReturnValue(ApexType.STRING)

        const ctx = TestUtil.createArithmeticExpression('acc.Name', '+', '5')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then should mutate + when sObject field is numeric (acc.NumberOfEmployees)', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'Account',
          'acc'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        mockRepository.isSObject.mockReturnValue(true)
        mockRepository.resolveFieldType.mockReturnValue(ApexType.INTEGER)

        const ctx = TestUtil.createArithmeticExpression(
          'acc.NumberOfEmployees',
          '+',
          '5'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
      })

      it('Then should NOT mutate + when sObject field is unknown (conservative)', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'Account',
          'acc'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        mockRepository.isSObject.mockReturnValue(true)
        mockRepository.resolveFieldType.mockReturnValue(undefined)

        const ctx = TestUtil.createArithmeticExpression(
          'acc.UnknownField',
          '+',
          '5'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('Given field access operands without sObject describe data via legacy path', () => {
      it('Then should NOT mutate + when root type is non-numeric (obj.field, fallback)', () => {
        // Arrange
        const sut = new ArithmeticOperatorMutator()
        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'MyObject',
          'obj'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        const ctx = TestUtil.createArithmeticExpression('obj.field', '+', 'x')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then should mutate + when root type is numeric (wrapper.value, fallback)', () => {
        // Arrange
        const sut = new ArithmeticOperatorMutator()
        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'Integer',
          'wrapper'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        const ctx = TestUtil.createArithmeticExpression(
          'wrapper.value',
          '+',
          '1'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
      })
    })

    describe('Given edge cases for type tracking via legacy path', () => {
      it('Then should handle enterFormalParameter with no children gracefully', () => {
        // Arrange
        const sut = new ArithmeticOperatorMutator()
        const paramCtx = { children: null } as unknown as ParserRuleContext

        // Act & Assert
        expect(() => sut.enterFormalParameter(paramCtx)).not.toThrow()
      })

      it('Then should handle enterEnhancedForControl with no children gracefully', () => {
        // Arrange
        const sut = new ArithmeticOperatorMutator()
        const forCtx = { children: null } as unknown as ParserRuleContext

        // Act & Assert
        expect(() => sut.enterEnhancedForControl(forCtx)).not.toThrow()
      })

      it('Then should handle enterLocalVariableDeclaration with no children gracefully', () => {
        // Arrange
        const sut = new ArithmeticOperatorMutator()
        const varCtx = { children: null } as unknown as ParserRuleContext

        // Act & Assert
        expect(() => sut.enterLocalVariableDeclaration(varCtx)).not.toThrow()
      })

      it('Then should handle enterFieldDeclaration with no children gracefully', () => {
        // Arrange
        const sut = new ArithmeticOperatorMutator()
        const fieldCtx = { children: null } as unknown as ParserRuleContext

        // Act & Assert
        expect(() => sut.enterFieldDeclaration(fieldCtx)).not.toThrow()
      })

      it('Then should mutate + when method call is not in type table via legacy path', () => {
        // Arrange
        const sut = new ArithmeticOperatorMutator()
        sut.setTypeTable(new Map())
        const ctx = TestUtil.createArithmeticExpression(
          'unknownMethod()',
          '+',
          'x'
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(3)
      })

      it('Then should handle variable declarations with comma separators via legacy path', () => {
        // Arrange
        const sut = new ArithmeticOperatorMutator()
        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varCtx = {
          children: [
            { text: 'String' },
            { text: 'a' },
            { text: ',' },
            { text: 'b' },
          ],
          childCount: 4,
          start: TestUtil.createToken(1, 0),
        } as unknown as ParserRuleContext
        sut.enterLocalVariableDeclaration(varCtx)

        const ctx = TestUtil.createArithmeticExpression('b', '+', 'x')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then should handle variable declarations with initializer (=) via legacy path', () => {
        // Arrange
        const sut = new ArithmeticOperatorMutator()
        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varCtx = {
          children: [{ text: 'String' }, { text: "name='test'" }],
          childCount: 2,
          start: TestUtil.createToken(1, 0),
        } as unknown as ParserRuleContext
        sut.enterLocalVariableDeclaration(varCtx)

        const ctx = TestUtil.createArithmeticExpression('name', '+', 'x')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then should resolve unknown type as OBJECT (non-numeric) via legacy path', () => {
        // Arrange
        const sut = new ArithmeticOperatorMutator()
        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varCtx = TestUtil.createLocalVariableDeclaration('Account', 'acc')
        sut.enterLocalVariableDeclaration(varCtx)

        const ctx = TestUtil.createArithmeticExpression('acc', '+', 'x')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })
})
