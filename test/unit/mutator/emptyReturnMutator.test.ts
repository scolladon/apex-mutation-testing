import { ParserRuleContext } from 'antlr4ts'
import { MethodDeclarationContext } from 'apex-parser'
import { EmptyReturnMutator } from '../../../src/mutator/emptyReturnMutator.js'
import {
  APEX_TYPE,
  ApexMethod,
  ApexType,
} from '../../../src/type/ApexMethod.js'
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
        type: APEX_TYPE.INTEGER,
        returnType: 'Integer',
        expression: '42',
        expected: '0',
      },
      {
        type: APEX_TYPE.STRING,
        returnType: 'String',
        expression: 'Hello',
        expected: "''",
      },
      {
        type: APEX_TYPE.LONG,
        returnType: 'Long',
        expression: '42L',
        expected: '0L',
      },
      {
        type: APEX_TYPE.DECIMAL,
        returnType: 'Decimal',
        expression: '42.5',
        expected: '0.0',
      },
      {
        type: APEX_TYPE.DOUBLE,
        returnType: 'Double',
        expression: '42.5',
        expected: '0.0',
      },
      {
        type: APEX_TYPE.ID,
        returnType: 'ID',
        expression: 'someId',
        expected: "''",
      },
      {
        type: APEX_TYPE.LIST,
        returnType: 'List<String>',
        expression: 'myList',
        expected: 'new List<String>()',
        elementType: 'String',
      },
      {
        type: APEX_TYPE.BLOB,
        returnType: 'Blob',
        expression: 'myBlob',
        expected: "Blob.valueOf('')",
      },
      {
        type: APEX_TYPE.SET,
        returnType: 'Set<String>',
        expression: 'mySet',
        expected: 'new Set<String>()',
        elementType: 'String',
      },
      {
        type: APEX_TYPE.MAP,
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
      { type: APEX_TYPE.VOID, name: 'void' },
      { type: APEX_TYPE.BOOLEAN, name: 'Boolean' },
      { type: APEX_TYPE.SOBJECT, name: 'SObject' },
      { type: APEX_TYPE.OBJECT, name: 'Object' },
      { type: APEX_TYPE.APEX_CLASS, name: 'SomeClass' },
      { type: APEX_TYPE.DATE, name: 'Date' },
      { type: APEX_TYPE.DATETIME, name: 'DateTime' },
      { type: APEX_TYPE.TIME, name: 'Time' },
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

    describe('Double and Decimal zero value edge cases', () => {
      it.each([
        { type: 'Double', value: '0', expected: true },
        { type: 'Decimal', value: '0', expected: true },
        { type: 'Double', value: '0.00', expected: true },
        { type: 'Decimal', value: '0.00', expected: true },
        { type: 'Double', value: '0.000', expected: true },
        { type: 'Decimal', value: '0.000', expected: true },
        { type: 'Double', value: '1.0', expected: false },
        { type: 'Decimal', value: '1.0', expected: false },
      ])('Given $type type with value $value, When checking isEmpty, Then returns $expected', testCase => {
        // Arrange
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue(testCase.type, testCase.value)

        // Assert
        expect(result).toBe(testCase.expected)
      })

      it('Given Double type with 00.0 (not anchored at start), When checking isEmpty, Then returns false', () => {
        // Arrange
        const sut = new EmptyReturnMutator()

        // Act — 00.0 should NOT be treated as empty (it's not zero in the sense 0.0)
        const result = sut.isEmptyValue('Double', '00.0')

        // Assert — regex /^0\.0+$/ anchors at start so 00.0 doesn't match
        expect(result).toBe(false)
      })

      it('Given Decimal type with 00.0 (not anchored at start), When checking isEmpty, Then returns false', () => {
        // Arrange
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue('Decimal', '00.0')

        // Assert
        expect(result).toBe(false)
      })

      it('Given Double type with 0.0abc (not anchored at end), When checking isEmpty, Then returns false', () => {
        // Arrange
        const sut = new EmptyReturnMutator()

        // Act — regex /^0\.0+$/ anchors at end so 0.0abc doesn't match
        const result = sut.isEmptyValue('Double', '0.0abc')

        // Assert
        expect(result).toBe(false)
      })

      it('Given Decimal type with 0.0abc (not anchored at end), When checking isEmpty, Then returns false', () => {
        // Arrange
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue('Decimal', '0.0abc')

        // Assert
        expect(result).toBe(false)
      })

      it('Given Long type with 0 (string literal), When checking isEmpty, Then returns true', () => {
        // Arrange
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue('Long', '0')

        // Assert
        expect(result).toBe(true)
      })
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
        type: APEX_TYPE.INTEGER,
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
        type: APEX_TYPE.INTEGER,
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
        type: APEX_TYPE.INTEGER,
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
        type: APEX_TYPE.INTEGER,
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

  describe('array notation type — isEmptyValue edge cases', () => {
    it('Given String[] type with matching new array syntax, When checking isEmpty, Then returns true', () => {
      // Arrange — exercises the lowerType.endsWith('[]') branch of the || operator
      const sut = new EmptyReturnMutator()

      // Act
      const result = sut.isEmptyValue('String[]', 'new String[]{}')

      // Assert — kills lowerType.endsWith('[]') removal / || → && mutant
      expect(result).toBe(true)
    })

    it('Given String[] type with non-empty array, When checking isEmpty, Then returns false', () => {
      // Arrange — exercises the endsWith('[]') branch with a non-empty expression
      const sut = new EmptyReturnMutator()

      // Act
      const result = sut.isEmptyValue('String[]', 'myArray')

      // Assert
      expect(result).toBe(false)
    })

    it('Given List<String> type (startsWith list<) with array init syntax, When checking isEmpty, Then returns true', () => {
      // Arrange — exercises the || between the two regexes: array syntax matches second regex
      const sut = new EmptyReturnMutator()

      // Act
      const result = sut.isEmptyValue('List<String>', 'new String[]{}')

      // Assert — the second regex /new\s+[^[\]]+\[\s*\]\s*\{\s*\}/ should match
      expect(result).toBe(true)
    })

    it('Given List<String> type with spaced array init syntax, When checking isEmpty, Then returns true', () => {
      // Arrange — exercises whitespace in the array regex
      const sut = new EmptyReturnMutator()

      // Act
      const result = sut.isEmptyValue('List<String>', 'new String[ ]{ }')

      // Assert
      expect(result).toBe(true)
    })

    it('Given List<String> type with non-empty list constructor, When checking isEmpty, Then returns false', () => {
      // Arrange — null check happens before list check — this verifies it is still false
      const sut = new EmptyReturnMutator()

      // Act
      const result = sut.isEmptyValue('List<String>', 'new List<String>(1)')

      // Assert
      expect(result).toBe(false)
    })

    it('Given Long type with 0 as integer literal, When checking isEmpty, Then returns true', () => {
      // Arrange — exercises the first part of Long: expr === '0' (kills 0 → '' mutation on right side of ||)
      const sut = new EmptyReturnMutator()

      // Act
      const result = sut.isEmptyValue('Long', '0')

      // Assert
      expect(result).toBe(true)
    })

    it('Given String type with non-empty string, When checking isEmpty, Then returns false', () => {
      // Arrange
      const sut = new EmptyReturnMutator()

      // Act
      const result = sut.isEmptyValue('String', "'hello'")

      // Assert — exercises the == check for String which is exact match to "''"
      expect(result).toBe(false)
    })

    it('Given Integer type with 0 (string), When checking isEmpty, Then returns true', () => {
      // Arrange
      const sut = new EmptyReturnMutator()

      // Act
      const result = sut.isEmptyValue('Integer', '0')

      // Assert — kills mutation changing === '0' to === '' or similar
      expect(result).toBe(true)
    })

    it('Given unknown type with null expression, When checking isEmpty, Then returns true', () => {
      // Arrange — exercises the null check before emptyValuePatterns lookup
      const sut = new EmptyReturnMutator()

      // Act
      const result = sut.isEmptyValue('CustomType', 'null')

      // Assert — null is always empty regardless of type
      expect(result).toBe(true)
    })

    it('Given unknown type with non-null expression, When checking isEmpty, Then returns false', () => {
      // Arrange — exercises the fallthrough return false
      const sut = new EmptyReturnMutator()

      // Act
      const result = sut.isEmptyValue('CustomType', 'someValue')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('regex whitespace sensitivity — isEmptyValue', () => {
    describe('List type regex — multi-space and spaced parens', () => {
      it('Given List<String> type with multiple spaces after new, When checking isEmpty, Then returns true (kills \\s+ → \\s mutant)', () => {
        // Arrange — two spaces after 'new' distinguishes \s+ (one-or-more) from \s (exactly one)
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue('List<String>', 'new  List<String>()')

        // Assert
        expect(result).toBe(true)
      })

      it('Given List<String> type with space between > and (, When checking isEmpty, Then returns true (kills \\s* → \\S* mutant)', () => {
        // Arrange — \s* matches the space before (, \S* would not
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue('List<String>', 'new List<String> ()')

        // Assert
        expect(result).toBe(true)
      })

      it('Given List<String> type with spaces inside parens, When checking isEmpty, Then returns true (kills inner \\s* → \\S* mutant)', () => {
        // Arrange — \s* inside () matches the spaces, \S* would not
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue('List<String>', 'new List<String>(  )')

        // Assert
        expect(result).toBe(true)
      })
    })

    describe('Array notation regex — multi-space and spaced braces', () => {
      it('Given List type with array init and multiple spaces after new, When checking isEmpty, Then returns true (kills \\s+ → \\s mutant)', () => {
        // Arrange — two spaces after 'new' in the array-init syntax
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue('List<String>', 'new  String[]{}')

        // Assert
        expect(result).toBe(true)
      })

      it('Given List type with array init and space between ] and {, When checking isEmpty, Then returns true (kills \\s* → \\S* mutant)', () => {
        // Arrange — space between ] and { distinguishes \s* from \S*
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue('List<String>', 'new String[] {}')

        // Assert
        expect(result).toBe(true)
      })
    })

    describe('Set type regex — multi-space and spaced parens', () => {
      it('Given Set<String> type with multiple spaces after new, When checking isEmpty, Then returns true (kills \\s+ → \\s mutant)', () => {
        // Arrange — two spaces after 'new'
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue('Set<String>', 'new  Set<String>()')

        // Assert
        expect(result).toBe(true)
      })

      it('Given Set<String> type with space between > and (, When checking isEmpty, Then returns true (kills \\s* → \\S* mutant)', () => {
        // Arrange — space between > and (
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue('Set<String>', 'new Set<String> ()')

        // Assert
        expect(result).toBe(true)
      })

      it('Given Set<String> type with spaces inside parens, When checking isEmpty, Then returns true (kills inner \\s* → \\S* mutant)', () => {
        // Arrange — spaces inside ()
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue('Set<String>', 'new Set<String>(  )')

        // Assert
        expect(result).toBe(true)
      })
    })

    describe('Map type regex — multi-space and spaced parens', () => {
      it('Given Map<String,Integer> type with multiple spaces after new, When checking isEmpty, Then returns true (kills \\s+ → \\s mutant)', () => {
        // Arrange — two spaces after 'new'
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue(
          'Map<String,Integer>',
          'new  Map<String,Integer>()'
        )

        // Assert
        expect(result).toBe(true)
      })

      it('Given Map<String,Integer> type with space between > and (, When checking isEmpty, Then returns true (kills \\s* → \\S* mutant)', () => {
        // Arrange — space between > and (
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue(
          'Map<String,Integer>',
          'new Map<String,Integer> ()'
        )

        // Assert
        expect(result).toBe(true)
      })

      it('Given Map<String,Integer> type with spaces inside parens, When checking isEmpty, Then returns true (kills inner \\s* → \\S* mutant)', () => {
        // Arrange — spaces inside ()
        const sut = new EmptyReturnMutator()

        // Act
        const result = sut.isEmptyValue(
          'Map<String,Integer>',
          'new Map<String,Integer>(  )'
        )

        // Assert
        expect(result).toBe(true)
      })
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
})
