import { ParserRuleContext } from 'antlr4ts'
import { MethodDeclarationContext } from 'apex-parser'
import { TrueReturnMutator } from '../../../src/mutator/trueReturnMutator.js'
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
    { text: 'Boolean' },
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

describe('TrueReturnMutator', () => {
  describe('boolean return mutations', () => {
    const testCases = [
      { name: 'literal false', expression: 'false', expected: 'true' },
      { name: 'comparison expression', expression: 'a < b', expected: 'true' },
      { name: 'logical expression', expression: 'a && b', expected: 'true' },
      {
        name: 'complex expression',
        expression: '(a || b) && c',
        expected: 'true',
      },
    ]

    it.each(
      testCases
    )('Given $name return value, When entering return statement, Then creates true mutation', testCase => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new TrueReturnMutator(typeRegistry)
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

  describe('already true values', () => {
    it('Given already true return value, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new TrueReturnMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('true', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('non-boolean return types', () => {
    const testCases = [
      {
        type: ApexType.INTEGER,
        typeName: 'Integer',
        expression: '42',
      },
      {
        type: ApexType.STRING,
        typeName: 'String',
        expression: '"test"',
      },
      {
        type: ApexType.VOID,
        typeName: 'void',
        expression: '',
      },
      {
        type: ApexType.OBJECT,
        typeName: 'Account',
        expression: 'new Account()',
      },
    ]

    it.each(
      testCases
    )('Given $typeName return type, When entering return statement, Then no mutation created', testCase => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: testCase.typeName,
        startLine: 1,
        endLine: 5,
        type: testCase.type,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new TrueReturnMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod(
        testCase.expression,
        'testMethod'
      )

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
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new TrueReturnMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('false', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given no enclosing method, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new TrueReturnMutator(typeRegistry)
      const returnCtx = TestUtil.createReturnStatement('false')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given return statement with no children, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new TrueReturnMutator(typeRegistry)

      const returnCtx = {
        children: null,
        childCount: 0,
      } as unknown as ParserRuleContext
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'Boolean' },
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
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new TrueReturnMutator(typeRegistry)

      const returnCtx = {
        children: [{ text: 'return' }, { text: 'false' }],
        childCount: 2,
        getChild: (i: number) =>
          i === 0 ? { text: 'return' } : { text: 'false' },
      } as unknown as ParserRuleContext
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'Boolean' },
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

  describe('backward compatibility (legacy typeTable path)', () => {
    it('Given legacy typeTable setup, When entering return statement, Then creates mutation', () => {
      // Arrange
      const sut = new TrueReturnMutator()
      const methodCtx = TestUtil.createMethodDeclaration(
        'Boolean',
        'testMethod'
      )
      sut.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })
      sut.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('false')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('true')
    })

    it('Given legacy typeTable with non-boolean method, When entering return statement, Then no mutation created', () => {
      // Arrange
      const sut = new TrueReturnMutator()
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
      expect(sut._mutations).toHaveLength(0)
    })
  })
})
