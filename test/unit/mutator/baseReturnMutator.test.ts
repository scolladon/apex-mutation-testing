import { ParserRuleContext } from 'antlr4ts'
import { MethodDeclarationContext } from 'apex-parser'
import { BaseReturnMutator } from '../../../src/mutator/baseReturnMutator.js'
import {
  APEX_TYPE,
  ApexMethod,
  ApexType,
} from '../../../src/type/ApexMethod.js'
import { TypeRegistry } from '../../../src/type/TypeRegistry.js'
import { TestUtil } from '../../utils/testUtil.js'

class StubReturnMutator extends BaseReturnMutator {
  constructor(typeRegistry?: TypeRegistry) {
    super('stub', typeRegistry)
  }

  protected isEligibleReturnType(apexType: ApexType): boolean {
    return apexType !== APEX_TYPE.VOID
  }
}

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
  TestUtil.setParent(returnCtx, methodCtx)
  return returnCtx
}

describe('BaseReturnMutator', () => {
  describe('Given no TypeRegistry', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const sut = new StubReturnMutator()
      const returnCtx = createReturnCtxInMethod('someValue', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given TypeRegistry and ineligible return type (void)', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'void',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.VOID,
      })
      const sut = new StubReturnMutator(createTypeRegistry(typeTable))
      const returnCtx = createReturnCtxInMethod('someValue', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given TypeRegistry and expression already equals the return value', () => {
    it('Then should not create any mutations (no-op guard)', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const sut = new StubReturnMutator(createTypeRegistry(typeTable))
      const returnCtx = createReturnCtxInMethod('stub', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given TypeRegistry and eligible return type with different expression', () => {
    it('Then should create 1 mutation with the stub return value', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const sut = new StubReturnMutator(createTypeRegistry(typeTable))
      const returnCtx = createReturnCtxInMethod('someValue', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('stub')
    })
  })

  describe('Given TypeRegistry and unknown method (resolveType returns null)', () => {
    it('Then should not create any mutations (kills !!typeInfo → typeInfo || ... mutant)', () => {
      // Arrange
      // resolveType returns null for unknown methods.
      // With mutant `typeInfo` instead of `!!typeInfo`: null is falsy so same result.
      // With mutant `!!typeInfo &&` → `!!typeInfo ||`: true || anything = true → would mutate.
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('otherMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const sut = new StubReturnMutator(createTypeRegistry(typeTable))
      const returnCtx = createReturnCtxInMethod('someValue', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given no enclosing method context', () => {
    it('Then should not create any mutations (kills !methodName → methodName mutant)', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const sut = new StubReturnMutator(createTypeRegistry(typeTable))
      const returnCtx = TestUtil.createReturnStatement('someValue')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given TypeRegistry and return statement with null children', () => {
    it('Then should not create any mutations (kills !ctx.children → ctx.children mutant)', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const sut = new StubReturnMutator(createTypeRegistry(typeTable))

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
      TestUtil.setParent(returnCtx, methodCtx)

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given TypeRegistry and return statement with only one child', () => {
    it('Then should not create any mutations (kills ctx.children.length < 2 → <= 2 mutant)', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const sut = new StubReturnMutator(createTypeRegistry(typeTable))

      const returnCtx = {
        children: [{ text: 'return' }],
        childCount: 1,
      } as unknown as ParserRuleContext
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'String' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      TestUtil.setParent(returnCtx, methodCtx)

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given TypeRegistry and non-ParserRuleContext expression node', () => {
    it('Then should not create any mutations (kills expressionNode instanceof ParserRuleContext → true mutant)', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const sut = new StubReturnMutator(createTypeRegistry(typeTable))

      const returnCtx = {
        children: [{ text: 'return' }, { text: 'someValue' }],
        childCount: 2,
      } as unknown as ParserRuleContext
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'String' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      TestUtil.setParent(returnCtx, methodCtx)

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given TypeRegistry and return expression matching returnValue with different case', () => {
    it('Then should not create any mutations (kills toLowerCase() removal mutant)', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const sut = new StubReturnMutator(createTypeRegistry(typeTable))
      const returnCtx = createReturnCtxInMethod('STUB', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })
})
