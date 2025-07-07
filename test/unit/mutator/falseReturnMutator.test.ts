import { ParserRuleContext } from 'antlr4ts'
import { FalseReturnMutator } from '../../../src/mutator/falseReturnMutator.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

describe('FalseReturnMutator', () => {
  let falseReturnMutator: FalseReturnMutator

  beforeEach(() => {
    falseReturnMutator = new FalseReturnMutator()
  })

  describe('boolean return mutations', () => {
    const testCases = [
      { name: 'literal true', expression: 'true', expected: 'false' },
      { name: 'comparison expression', expression: 'a > b', expected: 'false' },
      { name: 'logical expression', expression: 'a || b', expected: 'false' },
      {
        name: 'complex expression',
        expression: '(a && b) || c',
        expected: 'false',
      },
    ]

    for (const testCase of testCases) {
      it(`should create mutation for ${testCase.name}`, () => {
        falseReturnMutator._mutations = []
        const methodCtx = TestUtil.createMethodDeclaration(
          'Boolean',
          'testMethod'
        )
        falseReturnMutator.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'Boolean',
          startLine: 1,
          endLine: 5,
          type: ApexType.BOOLEAN,
        })

        falseReturnMutator.setTypeTable(typeTable)
        const returnCtx = TestUtil.createReturnStatement(testCase.expression)

        // Act
        falseReturnMutator.enterReturnStatement(returnCtx)

        // Assert
        expect(falseReturnMutator._mutations.length).toBe(1)
        expect(falseReturnMutator._mutations[0].replacement).toBe(
          testCase.expected
        )
      })
    }

    it('should not create mutation for literal false', () => {
      falseReturnMutator._mutations = []
      const methodCtx = TestUtil.createMethodDeclaration(
        'Boolean',
        'testMethod'
      )
      falseReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      falseReturnMutator.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('false')

      // Act
      falseReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(falseReturnMutator._mutations.length).toBe(0)
    })
  })

  describe('non-boolean return types', () => {
    it('should not create mutations for non-boolean return types', () => {
      falseReturnMutator._mutations = []
      const methodCtx = TestUtil.createMethodDeclaration(
        'Integer',
        'testMethod'
      )
      falseReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      falseReturnMutator.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('42')

      // Act
      falseReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(falseReturnMutator._mutations.length).toBe(0)
    })
  })

  describe('validation and edge cases', () => {
    it('should handle null type info', () => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'Boolean',
        'testMethod'
      )
      falseReturnMutator.enterMethodDeclaration(methodCtx)

      const returnCtx = TestUtil.createReturnStatement('true')
      falseReturnMutator._mutations = []

      // Act
      falseReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(falseReturnMutator._mutations.length).toBe(0)
    })

    it('should handle missing method context', () => {
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      falseReturnMutator.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('true')
      falseReturnMutator._mutations = []

      // Act
      falseReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(falseReturnMutator._mutations.length).toBe(0)
    })

    // NEW: Test for missing children coverage
    it('should handle return statement with no children', () => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'Boolean',
        'testMethod'
      )
      falseReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      falseReturnMutator.setTypeTable(typeTable)

      const returnCtx = {
        children: null,
        childCount: 0,
      } as unknown as ParserRuleContext

      falseReturnMutator._mutations = []

      // Act
      falseReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(falseReturnMutator._mutations.length).toBe(0)
    })

    it('should handle return statement with insufficient children', () => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'Boolean',
        'testMethod'
      )
      falseReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      falseReturnMutator.setTypeTable(typeTable)

      const returnCtx = {
        children: [{ text: 'return' }],
        childCount: 1,
      } as unknown as ParserRuleContext

      falseReturnMutator._mutations = []

      // Act
      falseReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(falseReturnMutator._mutations.length).toBe(0)
    })

    it('should handle non-ParserRuleContext expression node', () => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'Boolean',
        'testMethod'
      )
      falseReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })

      falseReturnMutator.setTypeTable(typeTable)

      const returnCtx = {
        children: [
          { text: 'return' },
          { text: 'true' }, // Not a ParserRuleContext
        ],
        childCount: 2,
        getChild: (i: number) =>
          i === 0 ? { text: 'return' } : { text: 'true' },
      } as unknown as ParserRuleContext

      falseReturnMutator._mutations = []

      // Act
      falseReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(falseReturnMutator._mutations.length).toBe(0)
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
      falseReturnMutator.enterMethodDeclaration(methodCtx)

      // Assert
      expect(falseReturnMutator['currentMethodName']).toBe('testMethod')
    })

    it('should clear currentMethodName on exit', () => {
      // Arrange
      falseReturnMutator['currentMethodName'] = 'testMethod'

      // Act
      falseReturnMutator.exitMethodDeclaration()

      // Assert
      expect(falseReturnMutator['currentMethodName']).toBeNull()
    })
  })

  describe('token range handling', () => {
    it('should work with TokenRange structure', () => {
      // Arrange
      const tokenRange = TestUtil.createTokenRange('true', 3, 10)
      falseReturnMutator._mutations = []

      // Act
      falseReturnMutator._mutations.push({
        mutationName: 'FalseReturn',
        target: tokenRange,
        replacement: 'false',
      })

      // Assert
      expect(falseReturnMutator._mutations[0].target.text).toBe('true')
      if ('startToken' in falseReturnMutator._mutations[0].target) {
        expect(falseReturnMutator._mutations[0].target.startToken.line).toBe(3)
        expect(
          falseReturnMutator._mutations[0].target.startToken.charPositionInLine
        ).toBe(10)
      }
    })
  })
})
