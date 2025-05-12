import { ParserRuleContext } from 'antlr4ts'
import { NullReturnMutator } from '../../../src/mutator/nullReturnMutator.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

describe('NullReturnMutator', () => {
  let nullReturnMutator: NullReturnMutator

  beforeEach(() => {
    nullReturnMutator = new NullReturnMutator()
  })

  describe('non-primitive return type mutations', () => {
    const testCases = [
      {
        name: 'string',
        expression: '"Test String"',
        type: ApexType.STRING,
        expected: 'null',
      },
      {
        name: 'object',
        expression: 'new Account()',
        type: ApexType.OBJECT,
        expected: 'null',
      },
      {
        name: 'list',
        expression: 'new List<String>()',
        type: ApexType.LIST,
        expected: 'null',
      },
      {
        name: 'map',
        expression: 'new Map<Id, Account>()',
        type: ApexType.MAP,
        expected: 'null',
      },
    ]

    for (const testCase of testCases) {
      it(`should create mutation for ${testCase.name} return type`, () => {
        nullReturnMutator._mutations = []
        const methodCtx = TestUtil.createMethodDeclaration(
          testCase.name,
          'testMethod'
        )
        nullReturnMutator.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: testCase.name,
          startLine: 1,
          endLine: 5,
          type: testCase.type,
        })

        nullReturnMutator.setTypeTable(typeTable)
        const returnCtx = TestUtil.createReturnStatement(testCase.expression)

        // Act
        nullReturnMutator.enterReturnStatement(returnCtx)

        // Assert
        expect(nullReturnMutator._mutations.length).toBe(1)
        expect(nullReturnMutator._mutations[0].replacement).toBe(
          testCase.expected
        )
      })
    }
  })

  describe('primitive and non-primitive return types', () => {
    const testCases = [
      {
        type: ApexType.INTEGER,
        typeName: 'Integer',
        expression: '42',
        shouldMutate: true,
        expected: 'null',
      },
      {
        type: ApexType.DECIMAL,
        typeName: 'Decimal',
        expression: '3.14',
        shouldMutate: true,
        expected: 'null',
      },
      {
        type: ApexType.BOOLEAN,
        typeName: 'Boolean',
        expression: 'true',
        shouldMutate: true,
        expected: 'null',
      },
      {
        type: ApexType.VOID,
        typeName: 'void',
        expression: '',
        shouldMutate: false,
        expected: null,
      },
    ]

    for (const testCase of testCases) {
      it(`should ${testCase.shouldMutate ? '' : 'not '}create mutations for ${testCase.typeName} return type`, () => {
        nullReturnMutator._mutations = []
        const methodCtx = TestUtil.createMethodDeclaration(
          testCase.typeName,
          'testMethod'
        )
        nullReturnMutator.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: testCase.typeName,
          startLine: 1,
          endLine: 5,
          type: testCase.type,
        })

        nullReturnMutator.setTypeTable(typeTable)
        const returnCtx = TestUtil.createReturnStatement(testCase.expression)

        // Act
        nullReturnMutator.enterReturnStatement(returnCtx)

        // Assert
        if (testCase.shouldMutate) {
          expect(nullReturnMutator._mutations.length).toBe(1)
          expect(nullReturnMutator._mutations[0].replacement).toBe(
            testCase.expected
          )
        } else {
          expect(nullReturnMutator._mutations.length).toBe(0)
        }
      })
    }
  })

  describe('already null values', () => {
    it('should not create mutation for already null return values', () => {
      nullReturnMutator._mutations = []
      const methodCtx = TestUtil.createMethodDeclaration('String', 'testMethod')
      nullReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })

      nullReturnMutator.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('null')

      // Act
      nullReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(nullReturnMutator._mutations.length).toBe(0)
    })
  })

  describe('validation and edge cases', () => {
    it('should handle null type info', () => {
      const methodCtx = TestUtil.createMethodDeclaration('String', 'testMethod')
      nullReturnMutator.enterMethodDeclaration(methodCtx)

      const returnCtx = TestUtil.createReturnStatement('"test"')
      nullReturnMutator._mutations = []

      // Act
      nullReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(nullReturnMutator._mutations.length).toBe(0)
    })

    it('should handle missing method context', () => {
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })

      nullReturnMutator.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('"test"')
      nullReturnMutator._mutations = []

      // Act
      nullReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(nullReturnMutator._mutations.length).toBe(0)
    })

    it('should handle return statement without children', () => {
      const methodCtx = TestUtil.createMethodDeclaration('String', 'testMethod')
      nullReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })

      nullReturnMutator.setTypeTable(typeTable)

      const returnCtx = { children: [] } as unknown as ParserRuleContext
      nullReturnMutator._mutations = []

      // Act
      nullReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(nullReturnMutator._mutations.length).toBe(0)
    })

    it('should handle non-ParserRuleContext expression node', () => {
      const methodCtx = TestUtil.createMethodDeclaration('String', 'testMethod')
      nullReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })

      nullReturnMutator.setTypeTable(typeTable)

      const returnCtx = {
        children: [{ text: 'return' }, { text: '"test"' }],
        childCount: 2,
        getChild: (i: number) =>
          i === 0 ? { text: 'return' } : { text: '"test"' },
      } as unknown as ParserRuleContext

      nullReturnMutator._mutations = []

      // Act
      nullReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(nullReturnMutator._mutations.length).toBe(0)
    })
  })

  describe('method tracking', () => {
    it('should set currentMethodName on enter', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('String', 'testMethod')

      // Act
      nullReturnMutator.enterMethodDeclaration(methodCtx)

      // Assert
      expect(nullReturnMutator['currentMethodName']).toBe('testMethod')
    })

    it('should clear currentMethodName on exit', () => {
      // Arrange
      nullReturnMutator['currentMethodName'] = 'testMethod'

      // Act
      nullReturnMutator.exitMethodDeclaration()

      // Assert
      expect(nullReturnMutator['currentMethodName']).toBeNull()
    })
  })
})
