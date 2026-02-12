import { ParserRuleContext } from 'antlr4ts'
import { TrueReturnMutator } from '../../../src/mutator/trueReturnMutator.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

describe('TrueReturnMutator', () => {
  let trueReturnMutator: TrueReturnMutator

  beforeEach(() => {
    trueReturnMutator = new TrueReturnMutator()
  })

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

    it.each(testCases)('should create mutation for $name', testCase => {
      trueReturnMutator._mutations = []
      const methodCtx = TestUtil.createMethodDeclaration(
        'Boolean',
        'testMethod'
      )
      trueReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      trueReturnMutator.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement(testCase.expression)

      // Act
      trueReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(trueReturnMutator._mutations.length).toBe(1)
      expect(trueReturnMutator._mutations[0].replacement).toBe(
        testCase.expected
      )
    })

    it('should not create mutation for literal true', () => {
      trueReturnMutator._mutations = []
      const methodCtx = TestUtil.createMethodDeclaration(
        'Boolean',
        'testMethod'
      )
      trueReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      trueReturnMutator.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('true')

      // Act
      trueReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(trueReturnMutator._mutations.length).toBe(0)
    })
  })

  describe('non-boolean return types', () => {
    it('should not create mutations for non-boolean return types', () => {
      trueReturnMutator._mutations = []
      const methodCtx = TestUtil.createMethodDeclaration(
        'Integer',
        'testMethod'
      )
      trueReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      trueReturnMutator.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('42')

      // Act
      trueReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(trueReturnMutator._mutations.length).toBe(0)
    })
  })

  describe('validation and edge cases', () => {
    it('should handle null type info', () => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'Boolean',
        'testMethod'
      )
      trueReturnMutator.enterMethodDeclaration(methodCtx)

      const returnCtx = TestUtil.createReturnStatement('false')
      trueReturnMutator._mutations = []

      // Act
      trueReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(trueReturnMutator._mutations.length).toBe(0)
    })

    it('should handle missing method context', () => {
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      trueReturnMutator.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('false')
      trueReturnMutator._mutations = []

      // Act
      trueReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(trueReturnMutator._mutations.length).toBe(0)
    })

    it('should handle return statement without children', () => {
      // Setup
      const methodCtx = TestUtil.createMethodDeclaration(
        'Boolean',
        'testMethod'
      )
      trueReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      trueReturnMutator.setTypeTable(typeTable)

      const returnCtx = { children: [] } as unknown as ParserRuleContext
      trueReturnMutator._mutations = []

      // Act
      trueReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(trueReturnMutator._mutations.length).toBe(0)
    })

    it('should handle non-ParserRuleContext expression node', () => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'Boolean',
        'testMethod'
      )
      trueReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      trueReturnMutator.setTypeTable(typeTable)

      const returnCtx = {
        children: [
          { text: 'return' },
          { text: 'false' }, // Not a ParserRuleContext
        ],
        childCount: 2,
        getChild: (i: number) =>
          i === 0 ? { text: 'return' } : { text: 'false' },
      } as unknown as ParserRuleContext

      trueReturnMutator._mutations = []

      // Act
      trueReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(trueReturnMutator._mutations.length).toBe(0)
    })
  })

  describe('method tracking', () => {
    it('should set currentMethodName on enter', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration(
        'Boolean',
        'testMethod'
      )

      // Act
      trueReturnMutator.enterMethodDeclaration(methodCtx)

      // Assert
      expect(trueReturnMutator['currentMethodName']).toBe('testMethod')
    })

    it('should clear currentMethodName on exit', () => {
      // Arrange
      trueReturnMutator['currentMethodName'] = 'testMethod'

      // Act
      trueReturnMutator.exitMethodDeclaration()

      // Assert
      expect(trueReturnMutator['currentMethodName']).toBeNull()
    })
  })

  describe('token range handling', () => {
    it('should work with TokenRange structure', () => {
      // Arrange
      const tokenRange = TestUtil.createTokenRange('false', 3, 10)
      trueReturnMutator._mutations = []

      // Act
      trueReturnMutator._mutations.push({
        mutationName: 'TrueReturn',
        target: tokenRange,
        replacement: 'true',
      })

      // Assert
      expect(trueReturnMutator._mutations[0].target.text).toBe('false')
      if ('startToken' in trueReturnMutator._mutations[0].target) {
        expect(trueReturnMutator._mutations[0].target.startToken.line).toBe(3)
        expect(
          trueReturnMutator._mutations[0].target.startToken.charPositionInLine
        ).toBe(10)
      }
    })
  })
})
