import { ParserRuleContext } from 'antlr4ts'
import { MethodDeclarationContext } from 'apex-parser'
import { NullReturnMutator } from '../../../src/mutator/nullReturnMutator.js'
import { APEX_TYPE, ApexMethod } from '../../../src/type/ApexMethod.js'
import { TypeRegistry } from '../../../src/type/TypeRegistry.js'
import { TestUtil } from '../../utils/testUtil.js'

function createTypeRegistry(
  methodTypeTable: Map<string, ApexMethod>
): TypeRegistry {
  return new TypeRegistry(methodTypeTable, new Map(), new Map(), [])
}

function createReturnCtxInMethod(
  expression: string,
  methodName: string
): ParserRuleContext {
  const returnCtx = TestUtil.createReturnStatement(expression)
  const methodCtx = Object.create(MethodDeclarationContext.prototype)
  methodCtx.children = [
    { text: 'String' },
    { text: methodName },
    { text: '(' },
    { text: ')' },
  ]
  Object.defineProperty(returnCtx, 'parent', {
    value: methodCtx,
    writable: true,
    configurable: true,
  })
  return returnCtx
}

describe('NullReturnMutator', () => {
  describe('non-primitive return type mutations', () => {
    const testCases = [
      {
        name: 'string',
        expression: '"Test String"',
        type: APEX_TYPE.STRING,
        expected: 'null',
      },
      {
        name: 'object',
        expression: 'new Account()',
        type: APEX_TYPE.OBJECT,
        expected: 'null',
      },
      {
        name: 'list',
        expression: 'new List<String>()',
        type: APEX_TYPE.LIST,
        expected: 'null',
      },
      {
        name: 'map',
        expression: 'new Map<Id, Account>()',
        type: APEX_TYPE.MAP,
        expected: 'null',
      },
    ]

    it.each(
      testCases
    )('Given $name return type, When entering return statement, Then creates null mutation', testCase => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: testCase.name,
        startLine: 1,
        endLine: 5,
        type: testCase.type,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NullReturnMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod(
        testCase.expression,
        'testMethod'
      )

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe(testCase.expected)
    })
  })

  describe('primitive and non-primitive return types', () => {
    const testCases = [
      {
        type: APEX_TYPE.INTEGER,
        typeName: 'Integer',
        expression: '42',
        shouldMutate: true,
        expected: 'null',
      },
      {
        type: APEX_TYPE.DECIMAL,
        typeName: 'Decimal',
        expression: '3.14',
        shouldMutate: true,
        expected: 'null',
      },
      {
        type: APEX_TYPE.BOOLEAN,
        typeName: 'Boolean',
        expression: 'true',
        shouldMutate: true,
        expected: 'null',
      },
      {
        type: APEX_TYPE.VOID,
        typeName: 'void',
        expression: '',
        shouldMutate: false,
        expected: null,
      },
    ]

    it.each(
      testCases
    )('Given $typeName return type, When entering return statement, Then shouldMutate=$shouldMutate', testCase => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: testCase.typeName,
        startLine: 1,
        endLine: 5,
        type: testCase.type,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NullReturnMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod(
        testCase.expression,
        'testMethod'
      )

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      if (testCase.shouldMutate) {
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe(testCase.expected)
      } else {
        expect(sut._mutations).toHaveLength(0)
      }
    })
  })

  describe('already null values', () => {
    it('Given already null return value, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NullReturnMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('null', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('validation and edge cases', () => {
    it('Given unknown method, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('otherMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NullReturnMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('"test"', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given no enclosing method, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NullReturnMutator(typeRegistry)
      const returnCtx = TestUtil.createReturnStatement('"test"')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given return statement with no children, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NullReturnMutator(typeRegistry)

      const returnCtx = {
        children: null,
        childCount: 0,
      } as unknown as ParserRuleContext
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'String' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      Object.defineProperty(returnCtx, 'parent', {
        value: methodCtx,
        writable: true,
        configurable: true,
      })

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given non-ParserRuleContext expression node, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NullReturnMutator(typeRegistry)

      const returnCtx = {
        children: [{ text: 'return' }, { text: '"test"' }],
        childCount: 2,
        getChild: (i: number) =>
          i === 0 ? { text: 'return' } : { text: '"test"' },
      } as unknown as ParserRuleContext
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'String' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      Object.defineProperty(returnCtx, 'parent', {
        value: methodCtx,
        writable: true,
        configurable: true,
      })

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })
})
