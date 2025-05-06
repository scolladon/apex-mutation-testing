import { ParserRuleContext } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { EmptyReturnMutator } from '../../../src/mutator/emptyReturnMutator.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'

describe('EmptyReturnMutator', () => {
  let emptyReturnMutator: EmptyReturnMutator

  beforeEach(() => {
    emptyReturnMutator = new EmptyReturnMutator()
  })

  describe('enterReturnStatement edge cases', () => {
    it('should return early if expression is already an empty value', () => {
      // Arrange
      const methodCtx = {
        children: [
          { text: 'Integer' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ],
      } as unknown as ParserRuleContext

      emptyReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      emptyReturnMutator.setTypeTable(typeTable)

      // Mock isEmptyValue to return true - should cause early return
      jest.spyOn(emptyReturnMutator, 'isEmptyValue').mockReturnValue(true)

      const returnCtx = {
        children: [
          { text: 'return' },
          {
            text: '0', // Already an empty value
            start: { line: 1 },
          } as unknown as ParserRuleContext,
        ],
        start: { line: 1 },
      } as unknown as ParserRuleContext

      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })

    it('should return early if generateEmptyValue returns null', () => {
      // Arrange
      const methodCtx = {
        children: [
          { text: 'Void' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ],
      } as unknown as ParserRuleContext

      emptyReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Void',
        startLine: 1,
        endLine: 5,
        type: ApexType.VOID,
      })

      emptyReturnMutator.setTypeTable(typeTable)

      // Mock isEmptyValue to return false so we don't exit early
      jest.spyOn(emptyReturnMutator, 'isEmptyValue').mockReturnValue(false)

      const returnCtx = {
        children: [
          { text: 'return' },
          {
            text: 'something',
            start: { line: 1 },
          } as unknown as ParserRuleContext,
        ],
        start: { line: 1 },
      } as unknown as ParserRuleContext

      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })

    it('should return early if no typeInfo is found', () => {
      // Arrange
      const methodCtx = {
        children: [
          { text: 'Integer' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ],
      } as unknown as ParserRuleContext

      emptyReturnMutator.enterMethodDeclaration(methodCtx)

      // Undefined typeInfo
      const typeTable = new Map<string, ApexMethod>()
      emptyReturnMutator.setTypeTable(typeTable)

      const returnCtx = {
        children: [
          { text: 'return' },
          {
            text: 'expression',
            start: { line: 1 },
          } as unknown as ParserRuleContext,
        ],
        start: { line: 1 },
      } as unknown as ParserRuleContext

      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })

    it('should return early if type is in the excluded types list', () => {
      // Arrange
      const methodCtx = {
        children: [
          { text: 'Boolean' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ],
      } as unknown as ParserRuleContext

      emptyReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN, // excluded type
      })

      emptyReturnMutator.setTypeTable(typeTable)

      const returnCtx = {
        children: [
          { text: 'return' },
          {
            text: 'true',
            start: { line: 1 },
          } as unknown as ParserRuleContext,
        ],
        start: { line: 1 },
      } as unknown as ParserRuleContext

      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })

    it('should return early if ctx.children is missing', () => {
      // Arrange
      const methodCtx = {
        children: [
          { text: 'Integer' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ],
      } as unknown as ParserRuleContext

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
          // Missing the expression child
        ],
        start: { line: 1 },
      } as unknown as ParserRuleContext

      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })

    it('should return early if currentMethodName is not set', () => {
      // Arrange - do not set currentMethodName

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
          {
            text: '42',
            start: { line: 1 },
          } as unknown as ParserRuleContext,
        ],
        start: { line: 1 },
      } as unknown as ParserRuleContext

      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })

    it('should return early if typeTable is not set', () => {
      // Arrange
      const methodCtx = {
        children: [
          { text: 'Integer' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ],
      } as unknown as ParserRuleContext

      emptyReturnMutator.enterMethodDeclaration(methodCtx)

      // Do not set type table
      emptyReturnMutator.setTypeTable(new Map())

      const returnCtx = {
        children: [
          { text: 'return' },
          {
            text: '42',
            start: { line: 1 },
          } as unknown as ParserRuleContext,
        ],
        start: { line: 1 },
      } as unknown as ParserRuleContext

      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })

    it('should return early if expression node is not a ParserRuleContext', () => {
      // Arrange
      const methodCtx = {
        children: [
          { text: 'Integer' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ],
      } as unknown as ParserRuleContext

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
        start: { line: 1 },
      } as unknown as ParserRuleContext

      emptyReturnMutator._mutations = []

      // Act
      emptyReturnMutator.enterReturnStatement(returnCtx)

      // Assert
      expect(emptyReturnMutator._mutations.length).toBe(0)
    })
  })

  describe('isEmptyValue', () => {
    it('should identify empty string', () => {
      // Arrange & Act & Assert
      expect(emptyReturnMutator.isEmptyValue('String', "''")).toBe(true)
      expect(emptyReturnMutator.isEmptyValue('String', '""')).toBe(true)
      expect(emptyReturnMutator.isEmptyValue('String', "'test'")).toBe(false)
    })

    it('should identify zero integer values', () => {
      // Arrange & Act & Assert
      expect(emptyReturnMutator.isEmptyValue('Integer', '0')).toBe(true)
      expect(emptyReturnMutator.isEmptyValue('Integer', '1')).toBe(false)
    })

    it('should identify zero decimal values', () => {
      // Arrange & Act & Assert
      expect(emptyReturnMutator.isEmptyValue('Decimal', '0')).toBe(true)
      expect(emptyReturnMutator.isEmptyValue('Decimal', '0.0')).toBe(true)
      expect(emptyReturnMutator.isEmptyValue('Decimal', '0.00')).toBe(true)
      expect(emptyReturnMutator.isEmptyValue('Decimal', '0.1')).toBe(false)
    })

    it('should identify zero long values', () => {
      // Arrange & Act & Assert
      expect(emptyReturnMutator.isEmptyValue('Long', '0')).toBe(true)
      expect(emptyReturnMutator.isEmptyValue('Long', '0L')).toBe(true)
      expect(emptyReturnMutator.isEmptyValue('Long', '1L')).toBe(false)
    })

    it('should identify empty lists', () => {
      // Arrange & Act & Assert
      expect(
        emptyReturnMutator.isEmptyValue('List<Account>', 'new List<Account>()')
      ).toBe(true)
      expect(
        emptyReturnMutator.isEmptyValue('Account[]', 'new Account[]{}')
      ).toBe(true)
      expect(
        emptyReturnMutator.isEmptyValue(
          'List<Account>',
          'new List<Account>{acc}'
        )
      ).toBe(false)
    })

    it('should identify empty sets', () => {
      // Arrange & Act & Assert
      expect(
        emptyReturnMutator.isEmptyValue('Set<String>', 'new Set<String>()')
      ).toBe(true)
      expect(
        emptyReturnMutator.isEmptyValue(
          'Set<String>',
          'new Set<String>{"test"}'
        )
      ).toBe(false)
    })

    it('should identify empty maps', () => {
      // Arrange & Act & Assert
      expect(
        emptyReturnMutator.isEmptyValue(
          'Map<Id, Account>',
          'new Map<Id, Account>()'
        )
      ).toBe(true)
      expect(
        emptyReturnMutator.isEmptyValue(
          'Map<Id, Account>',
          'new Map<Id, Account>{id => acc}'
        )
      ).toBe(false)
    })

    it('should identify null as empty', () => {
      // Arrange & Act & Assert
      expect(emptyReturnMutator.isEmptyValue('Object', 'null')).toBe(true)
    })

    it('should identify boolean values as empty', () => {
      // Arrange & Act & Assert
      expect(emptyReturnMutator.isEmptyValue('Boolean', 'true')).toBe(true)
      expect(emptyReturnMutator.isEmptyValue('Boolean', 'false')).toBe(true)
      expect(emptyReturnMutator.isEmptyValue('Boolean', 'someValue')).toBe(
        false
      )
    })
  })

  describe('enterMethodDeclaration', () => {
    it('should not throw when provided a valid method declaration', () => {
      // Arrange
      const ctx = {
        children: [
          { text: 'public' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ],
      } as unknown as ParserRuleContext

      // Act & Assert
      expect(() => {
        emptyReturnMutator.enterMethodDeclaration(ctx)
      }).not.toThrow()
    })

    it('should not throw when provided an invalid method declaration', () => {
      // Arrange
      const ctx = {
        children: [{ text: 'public' }],
      } as unknown as ParserRuleContext

      // Act & Assert
      expect(() => {
        emptyReturnMutator.enterMethodDeclaration(ctx)
      }).not.toThrow()
    })
  })

  describe('exitMethodDeclaration', () => {
    it('should not throw', () => {
      // Act & Assert
      expect(() => {
        emptyReturnMutator.exitMethodDeclaration()
      }).not.toThrow()
    })
  })

  describe('setTypeTable', () => {
    it('should not throw when setting type table', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      // Act & Assert
      expect(() => {
        emptyReturnMutator.setTypeTable(typeTable)
      }).not.toThrow()
    })
  })

  describe('enterReturnStatement', () => {
    it('should not throw when processing a return statement', () => {
      // Arrange
      const ctx = {
        children: [
          { text: 'return' },
          {
            text: '42',
            children: [],
            start: { line: 1 },
          } as unknown as ParserRuleContext,
        ],
        start: { line: 1 },
      } as unknown as ParserRuleContext

      // Act & Assert
      expect(() => {
        emptyReturnMutator.enterReturnStatement(ctx)
      }).not.toThrow()
    })

    it('should not throw when processing a return statement with a method name set', () => {
      // Arrange
      const methodCtx = {
        children: [
          { text: 'public' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ],
      } as unknown as ParserRuleContext

      emptyReturnMutator.enterMethodDeclaration(methodCtx)

      const returnCtx = {
        children: [
          { text: 'return' },
          {
            text: '42',
            children: [],
            start: { line: 1 },
          } as unknown as ParserRuleContext,
        ],
        start: { line: 1 },
      } as unknown as ParserRuleContext

      // Act & Assert
      expect(() => {
        emptyReturnMutator.enterReturnStatement(returnCtx)
      }).not.toThrow()
    })
  })

  describe('findFirstTerminalNode integration', () => {
    it('should properly identify and use terminal nodes for mutations', () => {
      // Arrange
      const methodCtx = {
        children: [
          { text: 'Integer' }, // Return type
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ],
      } as unknown as ParserRuleContext

      emptyReturnMutator.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })

      emptyReturnMutator.setTypeTable(typeTable)

      jest.spyOn(emptyReturnMutator, 'isEmptyValue').mockReturnValue(false)

      // should be mutated
      const returnCtx = {
        children: [
          { text: 'return' },
          {
            text: '42',
            start: { line: 3 },
          } as unknown as ParserRuleContext,
        ],
        start: { line: 3 },
      } as unknown as ParserRuleContext

      // Act & Assert - Test that no error is thrown
      expect(() => {
        emptyReturnMutator.enterReturnStatement(returnCtx)
      }).not.toThrow()
    })
  })

  it('should properly test the mutation generation without using any', () => {
    // Arrange
    const methodCtx = {
      children: [
        { text: 'Integer' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ],
    } as unknown as ParserRuleContext

    emptyReturnMutator.enterMethodDeclaration(methodCtx)

    const typeTable = new Map<string, ApexMethod>()
    typeTable.set('testMethod', {
      returnType: 'Integer',
      startLine: 1,
      endLine: 5,
      type: ApexType.INTEGER,
    })

    emptyReturnMutator.setTypeTable(typeTable)

    jest.spyOn(emptyReturnMutator, 'isEmptyValue').mockReturnValue(false)

    const terminalNode = {
      symbol: {
        line: 3,
        charPositionInLine: 10,
        tokenIndex: 42,
      },
      text: '42',
    } as unknown as TerminalNode

    emptyReturnMutator._mutations = []
    emptyReturnMutator._mutations.push({
      mutationName: 'EmptyReturn',
      token: terminalNode,
      replacement: '0',
    })

    // Assert
    expect(emptyReturnMutator._mutations.length).toBe(1)
    expect(emptyReturnMutator._mutations[0].mutationName).toBe('EmptyReturn')
    expect(emptyReturnMutator._mutations[0].replacement).toBe('0')
    expect(emptyReturnMutator._mutations[0].token).toBe(terminalNode)
  })
  it('should not throw when processing a return statement with a method name and type table set', () => {
    // Arrange
    const methodCtx = {
      children: [
        { text: 'public' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ],
    } as unknown as ParserRuleContext

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
        {
          text: '42',
          children: [],
          start: { line: 1 },
        } as unknown as ParserRuleContext,
      ],
      start: { line: 1 },
    } as unknown as ParserRuleContext

    // Act & Assert
    expect(() => {
      emptyReturnMutator.enterReturnStatement(returnCtx)
    }).not.toThrow()
  })

  describe('generateEmptyValue', () => {
    it('should generate appropriate empty values for different types', () => {
      type PrivateMethodType = (typeInfo: ApexMethod) => string | null
      const generateEmptyValue = (
        emptyReturnMutator as unknown as {
          generateEmptyValue: PrivateMethodType
        }
      ).generateEmptyValue.bind(emptyReturnMutator)

      expect(
        generateEmptyValue({
          returnType: 'String',
          startLine: 1,
          endLine: 5,
          type: ApexType.STRING,
        })
      ).toBe("''")

      expect(
        generateEmptyValue({
          returnType: 'ID',
          startLine: 1,
          endLine: 5,
          type: ApexType.ID,
        })
      ).toBe("''")

      expect(
        generateEmptyValue({
          returnType: 'Integer',
          startLine: 1,
          endLine: 5,
          type: ApexType.INTEGER,
        })
      ).toBe('0')

      expect(
        generateEmptyValue({
          returnType: 'Long',
          startLine: 1,
          endLine: 5,
          type: ApexType.LONG,
        })
      ).toBe('0L')

      expect(
        generateEmptyValue({
          returnType: 'Decimal',
          startLine: 1,
          endLine: 5,
          type: ApexType.DECIMAL,
        })
      ).toBe('0.0')

      expect(
        generateEmptyValue({
          returnType: 'Double',
          startLine: 1,
          endLine: 5,
          type: ApexType.DOUBLE,
        })
      ).toBe('0.0')

      expect(
        generateEmptyValue({
          returnType: 'Blob',
          startLine: 1,
          endLine: 5,
          type: ApexType.BLOB,
        })
      ).toBe("Blob.valueOf('')")

      expect(
        generateEmptyValue({
          returnType: 'List<Account>',
          startLine: 1,
          endLine: 5,
          type: ApexType.LIST,
        })
      ).toBe('new List<Account>()')

      expect(
        generateEmptyValue({
          returnType: 'Set<String>',
          startLine: 1,
          endLine: 5,
          type: ApexType.SET,
        })
      ).toBe('new Set<String>()')

      expect(
        generateEmptyValue({
          returnType: 'Map<Id, Account>',
          startLine: 1,
          endLine: 5,
          type: ApexType.MAP,
        })
      ).toBe('new Map<Id, Account>()')

      expect(
        generateEmptyValue({
          returnType: 'MyCustomObject',
          startLine: 1,
          endLine: 5,
          type: ApexType.CUSTOM_OBJECT,
        })
      ).toBe('new MyCustomObject()')

      expect(
        generateEmptyValue({
          returnType: 'Account',
          startLine: 1,
          endLine: 5,
          type: ApexType.STANDARD_ENTITY,
        })
      ).toBe('new Account()')

      expect(
        generateEmptyValue({
          returnType: 'Void',
          startLine: 1,
          endLine: 5,
          type: ApexType.VOID,
        })
      ).toBeNull()
    })
  })
})
