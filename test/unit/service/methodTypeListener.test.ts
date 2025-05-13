import { ParserRuleContext } from 'antlr4ts'
import { MethodTypeListener } from '../../../src/mutator/methodTypeListener.js'
import { ApexType } from '../../../src/type/ApexMethod.js'

describe('MethodTypeListener', () => {
  let methodTypeListener: MethodTypeListener

  beforeEach(() => {
    methodTypeListener = new MethodTypeListener(
      new Set(['CustomApexClass']),
      new Set(['Account', 'Contact']),
      new Set(['CustomObject__c'])
    )
  })

  describe('enterMethodDeclaration', () => {
    it('should add method with void return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('void', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'void',
        startLine: 1,
        endLine: 5,
        type: ApexType.VOID,
      })
    })

    it('should add method with boolean return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('Boolean', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })
    })

    it('should add method with integer return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('Integer', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
    })

    it('should add method with long return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('Long', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'Long',
        startLine: 1,
        endLine: 5,
        type: ApexType.LONG,
      })
    })

    it('should add method with double return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('Double', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'Double',
        startLine: 1,
        endLine: 5,
        type: ApexType.DOUBLE,
      })
    })

    it('should add method with decimal return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('Decimal', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'Decimal',
        startLine: 1,
        endLine: 5,
        type: ApexType.DECIMAL,
      })
    })

    it('should add method with string return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('String', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })
    })

    it('should add method with ID return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('ID', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'ID',
        startLine: 1,
        endLine: 5,
        type: ApexType.ID,
      })
    })

    it('should add method with Blob return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('Blob', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'Blob',
        startLine: 1,
        endLine: 5,
        type: ApexType.BLOB,
      })
    })

    it('should add method with Date return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('Date', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'Date',
        startLine: 1,
        endLine: 5,
        type: ApexType.DATE,
      })
    })

    it('should add method with DateTime return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('DateTime', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'DateTime',
        startLine: 1,
        endLine: 5,
        type: ApexType.DATETIME,
      })
    })

    it('should add method with Time return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('Time', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'Time',
        startLine: 1,
        endLine: 5,
        type: ApexType.TIME,
      })
    })

    it('should add method with SObject return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('SObject', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'SObject',
        startLine: 1,
        endLine: 5,
        type: ApexType.SOBJECT,
      })
    })

    it('should add method with Object return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('Object', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'Object',
        startLine: 1,
        endLine: 5,
        type: ApexType.OBJECT,
      })
    })

    it('should add method with List return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext(
        'List<String>',
        'testMethod',
        1,
        5
      )

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'List<String>',
        startLine: 1,
        endLine: 5,
        type: ApexType.LIST,
        elementType: 'String',
      })
    })

    it('should add method with array return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('String[]', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'String[]',
        startLine: 1,
        endLine: 5,
        type: ApexType.LIST,
        elementType: 'String',
      })
    })

    it('should add method with Set return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext(
        'Set<String>',
        'testMethod',
        1,
        5
      )

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'Set<String>',
        startLine: 1,
        endLine: 5,
        type: ApexType.SET,
        elementType: 'String',
      })
    })

    it('should add method with Map return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext(
        'Map<String,Integer>',
        'testMethod',
        1,
        5
      )

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'Map<String,Integer>',
        startLine: 1,
        endLine: 5,
        type: ApexType.MAP,
        elementType: 'String,Integer',
      })
    })

    it('should add method with custom Apex class return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext(
        'CustomApexClass',
        'testMethod',
        1,
        5
      )

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'CustomApexClass',
        startLine: 1,
        endLine: 5,
        type: ApexType.APEX_CLASS,
      })
    })

    it('should add method with standard entity return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext('Account', 'testMethod', 1, 5)

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'Account',
        startLine: 1,
        endLine: 5,
        type: ApexType.STANDARD_ENTITY,
      })
    })

    it('should add method with custom object return type to type table', () => {
      // Arrange
      const ctx = createMethodDeclarationContext(
        'CustomObject__c',
        'testMethod',
        1,
        5
      )

      // Act
      methodTypeListener.enterMethodDeclaration(ctx)

      // Assert
      const typeTable = methodTypeListener.getMethodTypeTable()
      expect(typeTable.size).toBe(1)
      expect(typeTable.get('testMethod')).toEqual({
        returnType: 'CustomObject__c',
        startLine: 1,
        endLine: 5,
        type: ApexType.CUSTOM_OBJECT,
      })
    })
  })
})

// Helper function to create test contexts
function createMethodDeclarationContext(
  returnType: string,
  methodName: string,
  startLine: number,
  endLine: number
): ParserRuleContext {
  return {
    children: [
      { text: returnType },
      { text: methodName },
      { text: '(' },
      { text: ')' },
    ],
    start: { line: startLine },
    stop: { line: endLine },
  } as unknown as ParserRuleContext
}
