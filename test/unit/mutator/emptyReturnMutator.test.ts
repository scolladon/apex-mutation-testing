import { ParserRuleContext } from 'antlr4ts'
import { EmptyReturnMutator } from '../../../src/mutator/emptyReturnMutator.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

describe('EmptyReturnMutator', () => {
  let emptyReturnMutator: EmptyReturnMutator

  beforeEach(() => {
    emptyReturnMutator = new EmptyReturnMutator()
  })

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

    for (const testCase of testTypes) {
      it(`should handle ${testCase.returnType} type correctly`, () => {
        emptyReturnMutator._mutations = []
        const methodCtx = TestUtil.createMethodDeclaration(
          testCase.returnType,
          'testMethod'
        )
        emptyReturnMutator.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: testCase.returnType,
          startLine: 1,
          endLine: 5,
          type: testCase.type,
          ...(testCase.elementType
            ? { elementType: testCase.elementType }
            : {}),
        })

        emptyReturnMutator.setTypeTable(typeTable)
        const returnCtx = TestUtil.createReturnStatement(testCase.expression)

        // Act
        emptyReturnMutator.enterReturnStatement(returnCtx)

        // Assert
        expect(emptyReturnMutator._mutations.length).toBe(1)
        expect(emptyReturnMutator._mutations[0].replacement).toBe(
          testCase.expected
        )
      })
    }

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

    for (const excluded of excludedTypes) {
      it(`should not create mutations for ${excluded.name} type`, () => {
        emptyReturnMutator._mutations = []
        const methodCtx = TestUtil.createMethodDeclaration(
          excluded.name,
          'testMethod'
        )
        emptyReturnMutator.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: excluded.name,
          startLine: 1,
          endLine: 5,
          type: excluded.type,
        })

        emptyReturnMutator.setTypeTable(typeTable)
        const returnCtx = TestUtil.createReturnStatement('something')

        // Act
        emptyReturnMutator.enterReturnStatement(returnCtx)

        // Assert
        expect(emptyReturnMutator._mutations.length).toBe(0)
      })
    }
  })

  describe('empty value detection', () => {
    const emptyValueCases = [
      { type: 'String', value: "''", expected: true },
      { type: 'String', value: '""', expected: true },
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

    for (const testCase of emptyValueCases) {
      it(`should identify '${testCase.value}' as ${testCase.expected ? 'empty' : 'non-empty'} for ${testCase.type} type`, () => {
        const result = emptyReturnMutator.isEmptyValue(
          testCase.type,
          testCase.value
        )
        expect(result).toBe(testCase.expected)
      })
    }
  })

  describe('validation and edge cases', () => {
    it('should handle null type info', () => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'Integer',
        'testMethod'
      )
      emptyReturnMutator.enterMethodDeclaration(methodCtx)

      const returnCtx = TestUtil.createReturnStatement('42')
      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })

    it('should handle missing method context', () => {
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      emptyReturnMutator.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('42')
      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })

    it('should handle already empty values', () => {
      // Setup
      const methodCtx = TestUtil.createMethodDeclaration(
        'Integer',
        'testMethod'
      )
      emptyReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      emptyReturnMutator.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('0')
      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })

    it('should handle return statement without children', () => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'Integer',
        'testMethod'
      )
      emptyReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      emptyReturnMutator.setTypeTable(typeTable)

      const returnCtx = { children: [] } as unknown as ParserRuleContext
      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })

    it('should handle non-ParserRuleContext expression node', () => {
      // Setup
      const methodCtx = TestUtil.createMethodDeclaration(
        'Integer',
        'testMethod'
      )
      emptyReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      emptyReturnMutator.setTypeTable(typeTable)

      const returnCtx = {
        children: [
          { text: 'return' },
          { text: '42' }, // Not a ParserRuleContext
        ],
        childCount: 2,
        getChild: (i: number) =>
          i === 0 ? { text: 'return' } : { text: '42' },
      } as unknown as ParserRuleContext

      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })

    it('should handle unknown type when generating empty value', () => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'CustomType',
        'testMethod'
      )
      emptyReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'CustomType',
        startLine: 1,
        endLine: 5,
        type: 'UNKNOWN' as ApexType,
      })

      emptyReturnMutator.setTypeTable(typeTable)
      const returnCtx = TestUtil.createReturnStatement('someValue')
      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })
  })

  describe('token range handling', () => {
    it('should work with TokenRange structure', () => {
      // Arrange
      const tokenRange = TestUtil.createTokenRange('42', 3, 10)
      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator._mutations.push({
        mutationName: 'EmptyReturn',
        target: tokenRange,
        replacement: '0',
      })

      // Assert
      expect(emptyReturnMutator._mutations[0].target.text).toBe('42')
      if ('startToken' in emptyReturnMutator._mutations[0].target) {
        expect(emptyReturnMutator._mutations[0].target.startToken.line).toBe(3)
        expect(
          emptyReturnMutator._mutations[0].target.startToken.charPositionInLine
        ).toBe(10)
      }
    })
  })
})
