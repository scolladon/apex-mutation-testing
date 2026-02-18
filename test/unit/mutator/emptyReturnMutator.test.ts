import { ParserRuleContext } from 'antlr4ts'
import { MethodDeclarationContext } from 'apex-parser'
import { EmptyReturnMutator } from '../../../src/mutator/emptyReturnMutator.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'
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

describe('EmptyReturnMutator', () => {
  describe('return type handling', () => {
    const testTypes = [
      {
        type: ApexType.INTEGER,
        returnType: 'Integer',
        expression: '42',
        expected: '0',
      },
      {
        type: ApexType.STRING,
        returnType: 'String',
        expression: 'Hello',
        expected: "''",
      },
      {
        type: ApexType.LONG,
        returnType: 'Long',
        expression: '42L',
        expected: '0L',
      },
      {
        type: ApexType.DECIMAL,
        returnType: 'Decimal',
        expression: '42.5',
        expected: '0.0',
      },
      {
        type: ApexType.DOUBLE,
        returnType: 'Double',
        expression: '42.5',
        expected: '0.0',
      },
      {
        type: ApexType.ID,
        returnType: 'ID',
        expression: 'someId',
        expected: "''",
      },
      {
        type: ApexType.LIST,
        returnType: 'List<String>',
        expression: 'myList',
        expected: 'new List<String>()',
        elementType: 'String',
      },
      {
        type: ApexType.BLOB,
        returnType: 'Blob',
        expression: 'myBlob',
        expected: "Blob.valueOf('')",
      },
      {
        type: ApexType.SET,
        returnType: 'Set<String>',
        expression: 'mySet',
        expected: 'new Set<String>()',
        elementType: 'String',
      },
      {
        type: ApexType.MAP,
        returnType: 'Map<String, Integer>',
        expression: 'myMap',
        expected: 'new Map<String, Integer>()',
        elementType: 'String, Integer',
      },
    ]

    it.each(
      testTypes
    )('Given $returnType return type, When entering return statement, Then creates empty mutation with $expected', testCase => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: testCase.returnType,
        startLine: 1,
        endLine: 5,
        type: testCase.type,
        ...(testCase.elementType ? { elementType: testCase.elementType } : {}),
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new EmptyReturnMutator(typeRegistry)
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

    const excludedTypes = [
      { type: ApexType.VOID, name: 'void' },
      { type: ApexType.BOOLEAN, name: 'Boolean' },
      { type: ApexType.SOBJECT, name: 'SObject' },
      { type: ApexType.OBJECT, name: 'Object' },
      { type: ApexType.APEX_CLASS, name: 'SomeClass' },
      { type: ApexType.DATE, name: 'Date' },
      { type: ApexType.DATETIME, name: 'DateTime' },
      { type: ApexType.TIME, name: 'Time' },
    ]

    it.each(
      excludedTypes
    )('Given $name return type, When entering return statement, Then no mutation created', excluded => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: excluded.name,
        startLine: 1,
        endLine: 5,
        type: excluded.type,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new EmptyReturnMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('something', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('empty value detection', () => {
    const emptyValueCases = [
      { type: 'String', value: "''", expected: true },
      { type: 'String', value: "'Hello'", expected: false },

      { type: 'Integer', value: '0', expected: true },
      { type: 'Integer', value: '42', expected: false },
      { type: 'Long', value: '0L', expected: true },
      { type: 'Long', value: '42L', expected: false },
      { type: 'Double', value: '0.0', expected: true },
      { type: 'Double', value: '42.5', expected: false },

      { type: 'List<String>', value: 'new List<String>()', expected: true },
      { type: 'List<String>', value: 'myList', expected: false },
      { type: 'Set<String>', value: 'new Set<String>()', expected: true },
      {
        type: 'Set<String>',
        value: 'new Set<String>{ "value" }',
        expected: false,
      },
      {
        type: 'Map<String, Integer>',
        value: 'new Map<String, Integer>()',
        expected: true,
      },
      {
        type: 'Map<String, Integer>',
        value: 'new Map<String, Integer>{ "key" => 1 }',
        expected: false,
      },
    ]

    it.each(
      emptyValueCases
    )('Given $type type with value $value, When checking isEmpty, Then returns $expected', testCase => {
      // Arrange
      const sut = new EmptyReturnMutator()

      // Act
      const result = sut.isEmptyValue(testCase.type, testCase.value)

      // Assert
      expect(result).toBe(testCase.expected)
    })
  })

  describe('validation and edge cases', () => {
    it('Given unknown method, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('otherMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new EmptyReturnMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('42', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given no enclosing method, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new EmptyReturnMutator(typeRegistry)
      const returnCtx = TestUtil.createReturnStatement('42')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given already empty value, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new EmptyReturnMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('0', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given return statement with no children, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new EmptyReturnMutator(typeRegistry)

      const returnCtx = {
        children: null,
        childCount: 0,
      } as unknown as ParserRuleContext
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'Integer' },
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

    it('Given null expression text, When checking isEmpty, Then returns true', () => {
      // Arrange
      const sut = new EmptyReturnMutator()

      // Act & Assert
      expect(sut.isEmptyValue('String', 'null')).toBe(true)
    })

    it('Given non-ParserRuleContext expression node, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new EmptyReturnMutator(typeRegistry)

      const returnCtx = {
        children: [{ text: 'return' }, { text: '42' }],
        childCount: 2,
        getChild: (i: number) =>
          i === 0 ? { text: 'return' } : { text: '42' },
      } as unknown as ParserRuleContext
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'Integer' },
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

    it('Given unknown ApexType, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'CustomType',
        startLine: 1,
        endLine: 5,
        type: 'UNKNOWN' as ApexType,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new EmptyReturnMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('someValue', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('token range handling', () => {
    it('Given mutation with TokenRange, When inspecting target, Then contains correct token info', () => {
      // Arrange
      const tokenRange = TestUtil.createTokenRange('42', 3, 10)
      const sut = new EmptyReturnMutator()

      // Act
      sut._mutations.push({
        mutationName: 'EmptyReturnMutator',
        target: tokenRange,
        replacement: '0',
      })

      // Assert
      expect(sut._mutations[0].target.text).toBe('42')
      if ('startToken' in sut._mutations[0].target) {
        expect(sut._mutations[0].target.startToken.line).toBe(3)
        expect(sut._mutations[0].target.startToken.charPositionInLine).toBe(10)
      }
    })
  })

  describe('backward compatibility (legacy typeTable path)', () => {
    it('Given legacy typeTable setup, When entering return statement, Then creates mutation', () => {
      // Arrange
      const sut = new EmptyReturnMutator()
      const methodCtx = TestUtil.createMethodDeclaration(
        'Integer',
        'testMethod'
      )
      sut.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      sut.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('42')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('0')
    })

    it('Given legacy typeTable with excluded type, When entering return statement, Then no mutation created', () => {
      // Arrange
      const sut = new EmptyReturnMutator()
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'void',
        startLine: 1,
        endLine: 5,
        type: ApexType.VOID,
      })
      sut.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('something')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given legacy typeTable with missing method context, When entering return statement, Then no mutation created', () => {
      // Arrange
      const sut = new EmptyReturnMutator()
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      sut.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('42')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })
})
