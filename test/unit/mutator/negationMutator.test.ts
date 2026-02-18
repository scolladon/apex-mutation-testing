import { ParserRuleContext } from 'antlr4ts'
import { MethodDeclarationContext } from 'apex-parser'
import { NegationMutator } from '../../../src/mutator/negationMutator.js'
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
    { text: 'Integer' },
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

function createPreOpReturnCtxInMethod(
  operator: string,
  innerExpression: string,
  methodName: string
): ParserRuleContext {
  const returnCtx = TestUtil.createReturnStatementWithPreOp(
    operator,
    innerExpression
  )
  const methodCtx = Object.create(MethodDeclarationContext.prototype)
  methodCtx.children = [
    { text: 'Integer' },
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

function createComplexReturnCtxInMethod(
  expression: string,
  childCount: number,
  methodName: string
): ParserRuleContext {
  const returnCtx = TestUtil.createReturnStatementWithComplexExpression(
    expression,
    childCount
  )
  const methodCtx = Object.create(MethodDeclarationContext.prototype)
  methodCtx.children = [
    { text: 'Integer' },
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

describe('NegationMutator', () => {
  describe('numeric type mutations', () => {
    const numericTypes = [
      { type: APEX_TYPE.INTEGER, typeName: 'Integer' },
      { type: APEX_TYPE.LONG, typeName: 'Long' },
      { type: APEX_TYPE.DOUBLE, typeName: 'Double' },
      { type: APEX_TYPE.DECIMAL, typeName: 'Decimal' },
    ]

    it.each(
      numericTypes
    )('Given $typeName return type, When entering return statement, Then creates negation mutation', ({
      type,
      typeName,
    }) => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: typeName,
        startLine: 1,
        endLine: 5,
        type,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('value', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('-value')
    })
  })

  describe('non-numeric type mutations', () => {
    const nonNumericTypes = [
      { type: APEX_TYPE.STRING, typeName: 'String' },
      { type: APEX_TYPE.BOOLEAN, typeName: 'Boolean' },
      { type: APEX_TYPE.DATE, typeName: 'Date' },
      { type: APEX_TYPE.DATETIME, typeName: 'DateTime' },
      { type: APEX_TYPE.ID, typeName: 'Id' },
      { type: APEX_TYPE.LIST, typeName: 'List<String>' },
      { type: APEX_TYPE.MAP, typeName: 'Map<Id, Account>' },
      { type: APEX_TYPE.SET, typeName: 'Set<String>' },
      { type: APEX_TYPE.OBJECT, typeName: 'Account' },
      { type: APEX_TYPE.VOID, typeName: 'void' },
    ]

    it.each(
      nonNumericTypes
    )('Given $typeName return type, When entering return statement, Then no mutation created', ({
      type,
      typeName,
    }) => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: typeName,
        startLine: 1,
        endLine: 5,
        type,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('value', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('simple value negation', () => {
    it('Given Integer method returning variable, When entering return statement, Then creates negation mutation', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('x', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('-x')
      expect(sut._mutations[0].mutationName).toBe('NegationMutator')
    })

    it('Given Integer method returning numeric literal, When entering return statement, Then creates negation mutation', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('42', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('-42')
    })
  })

  describe('double negation prevention', () => {
    it('Given Integer method returning negated variable, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createPreOpReturnCtxInMethod('-', 'x', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given Integer method returning negated literal, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createPreOpReturnCtxInMethod('-', '42', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given Integer method returning pre-increment, When entering return statement, Then creates mutation', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createPreOpReturnCtxInMethod('++', 'x', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
    })
  })

  describe('complex expressions (smart wrapping)', () => {
    it('Given Integer method returning complex expression, When entering return statement, Then wraps in parentheses', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createComplexReturnCtxInMethod('a + b', 3, 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('-(a + b)')
    })

    it('Given Integer method returning simple variable, When entering return statement, Then does not wrap in parentheses', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('x', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('-x')
    })

    it('Given Integer method returning simple literal, When entering return statement, Then does not wrap in parentheses', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('42', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('-42')
    })
  })

  describe('zero literal prevention', () => {
    it('Given Integer method returning 0, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('0', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given Integer method returning 0.0, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('0.0', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given Integer method returning 0L, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('0L', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given Integer method returning non-zero literal, When entering return statement, Then creates mutation', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('10', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('-10')
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
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = createReturnCtxInMethod('x', 'testMethod')

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
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)
      const returnCtx = TestUtil.createReturnStatement('x')

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
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)

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

    it('Given non-ParserRuleContext expression node, When entering return statement, Then no mutation created', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
      })
      const typeRegistry = createTypeRegistry(typeTable)
      const sut = new NegationMutator(typeRegistry)

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
  })
})
