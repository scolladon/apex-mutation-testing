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

  describe('Given TypeRegistry and return expression matching returnValue with surrounding whitespace', () => {
    it('Then should not create any mutations (kills trim() removal mutant)', () => {
      // Arrange
      // Expression text has surrounding whitespace: ' stub '
      // Without trim(), ' stub '.toLowerCase() === 'stub' is false → mutation created (wrong)
      // With trim(), 'stub' === 'stub' is true → no mutation (correct)
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const sut = new StubReturnMutator(createTypeRegistry(typeTable))
      const returnCtx = createReturnCtxInMethod(' stub ', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given TypeRegistry and return expression matching returnValue with whitespace and different case', () => {
    it('Then should not create any mutations (kills both trim() and toLowerCase() removal mutants)', () => {
      // Arrange
      // Expression ' STUB ' requires both trim and toLowerCase to match 'stub'
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const sut = new StubReturnMutator(createTypeRegistry(typeTable))
      const returnCtx = createReturnCtxInMethod(' STUB ', 'testMethod')

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given TypeRegistry and return statement where children.length < 2 but children[1] exists as ParserRuleContext', () => {
    it('Then should not create any mutations (kills length > 2 / length >= 2 / length < 1 mutants on the guard)', () => {
      // Arrange
      // Stryker mutates `ctx.children.length < 2` to `> 2`, `>= 2`, `< 1` etc.
      // Those mutants survive when children.length is 1 and children[1] is undefined (instanceof check saves them).
      // To kill them, we need children.length === 1 but children[1] to be a valid ParserRuleContext
      // so that without the length guard the code would proceed and create a mutation.
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const sut = new StubReturnMutator(createTypeRegistry(typeTable))

      // Build a fake expression node that is a ParserRuleContext with text != 'stub'
      const expressionNode = TestUtil.createExpressionNode('someValue')

      // children.length === 1 (so the guard `< 2` fires), but [1] returns the expression node.
      // Use a plain object shaped as an array-like: length=1 but index 1 is accessible.
      // This exposes mutants that skip the length check: they would proceed to instanceof check
      // (passes), text check ('someValue' !== 'stub'), and create a mutation.
      // Using a plain object (not Array) because JS arrays don't allow redefining length.
      const fakeChildren: { length: number; [index: number]: unknown } = {
        length: 1,
        0: { text: 'return' },
        1: expressionNode,
      }

      const returnCtx = {
        children: fakeChildren,
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

      // Assert — length guard must fire, preventing any mutation
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given TypeRegistry with eligible return type Integer', () => {
    it('Then should create mutation (confirms isEligibleReturnType works for non-VOID non-STRING types)', () => {
      // Arrange — INTEGER is eligible (non-VOID), so a mutation should be created.
      // This exercises isMutableReturn returning true for INTEGER type,
      // which helps kill BlockStatement mutant on the `isMutableReturn` body.
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.INTEGER,
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

  describe('Given TypeRegistry and isMutableReturn where typeInfo exists but isEligibleReturnType is false', () => {
    it('Then should not create mutations (kills !!typeInfo && isEligible → !!typeInfo || isEligible mutant)', () => {
      // Arrange — VOID type: typeInfo is non-null (method exists), but isEligibleReturnType returns false.
      // With mutant `&&` → `||`: `!!typeInfo || false` = `true || false` = true → proceeds → creates mutation.
      // Original: `!!typeInfo && false` = `true && false` = false → returns false → no mutation.
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

  describe('Given TypeRegistry where typeRegistry is provided but methodName matches a method returning eligible type', () => {
    it('Then should create mutation (confirms both !!typeInfo and isEligibleReturnType must be true)', () => {
      // Arrange — Both conditions in `!!typeInfo && isEligibleReturnType(...)` must be true.
      // This test paired with the VOID test above kills `&&` → `||` because:
      // VOID test: typeInfo non-null, eligible=false → `||` mutant would create mutation (wrong)
      // This test: typeInfo non-null, eligible=true → both guards give same result → need both
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.BOOLEAN,
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

  describe('Given TypeRegistry and eligible return with children having exactly 2 entries', () => {
    it('Then should create a mutation confirming length < 2 does not block the happy path', () => {
      // Arrange — verifies `< 2` (not `> 2` or other mutants) allows exactly-2-children through
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
    })
  })
})
