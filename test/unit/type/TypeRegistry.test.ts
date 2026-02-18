import { TypeMatcher } from '../../../src/service/typeMatcher.js'
import type { ApexMethod } from '../../../src/type/ApexMethod.js'
import { ApexType } from '../../../src/type/ApexMethod.js'
import { TypeRegistry } from '../../../src/type/TypeRegistry.js'

describe('TypeRegistry', () => {
  describe('resolveType without expression', () => {
    it('Given known method name, When resolveType, Then returns method return type as ResolvedType', () => {
      // Arrange
      const methodTypeTable = new Map<string, ApexMethod>([
        [
          'myMethod',
          {
            returnType: 'Integer',
            startLine: 1,
            endLine: 5,
            type: ApexType.INTEGER,
          },
        ],
      ])
      const registry = new TypeRegistry(
        methodTypeTable,
        new Map(),
        new Map(),
        []
      )

      // Act
      const result = registry.resolveType('myMethod')

      // Assert
      expect(result).toEqual({
        apexType: ApexType.INTEGER,
        typeName: 'Integer',
      })
    })

    it('Given method with elementType, When resolveType, Then includes elementType in ResolvedType', () => {
      // Arrange
      const methodTypeTable = new Map<string, ApexMethod>([
        [
          'getItems',
          {
            returnType: 'List<String>',
            startLine: 1,
            endLine: 5,
            type: ApexType.LIST,
            elementType: 'String',
          },
        ],
      ])
      const registry = new TypeRegistry(
        methodTypeTable,
        new Map(),
        new Map(),
        []
      )

      // Act
      const result = registry.resolveType('getItems')

      // Assert
      expect(result).toEqual({
        apexType: ApexType.LIST,
        typeName: 'List<String>',
        elementType: 'String',
      })
    })

    it('Given unknown method name, When resolveType, Then returns null', () => {
      // Arrange
      const registry = new TypeRegistry(new Map(), new Map(), new Map(), [])

      // Act
      const result = registry.resolveType('unknownMethod')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('resolveType with simple variable expression', () => {
    it('Given variable in method scope, When resolveType with expression, Then resolves variable type', () => {
      // Arrange
      const methodTypeTable = new Map<string, ApexMethod>([
        [
          'myMethod',
          {
            returnType: 'void',
            startLine: 1,
            endLine: 5,
            type: ApexType.VOID,
          },
        ],
      ])
      const variableScopes = new Map<string, Map<string, string>>([
        ['myMethod', new Map([['x', 'String']])],
      ])
      const registry = new TypeRegistry(
        methodTypeTable,
        variableScopes,
        new Map(),
        []
      )

      // Act
      const result = registry.resolveType('myMethod', 'x')

      // Assert
      expect(result).toEqual({
        apexType: ApexType.STRING,
        typeName: 'String',
      })
    })

    it('Given variable not in method scope but in class fields, When resolveType, Then falls back to class fields', () => {
      // Arrange
      const methodTypeTable = new Map<string, ApexMethod>([
        [
          'myMethod',
          {
            returnType: 'void',
            startLine: 1,
            endLine: 5,
            type: ApexType.VOID,
          },
        ],
      ])
      const variableScopes = new Map<string, Map<string, string>>([
        ['myMethod', new Map()],
      ])
      const classFields = new Map<string, string>([['field', 'Boolean']])
      const registry = new TypeRegistry(
        methodTypeTable,
        variableScopes,
        classFields,
        []
      )

      // Act
      const result = registry.resolveType('myMethod', 'field')

      // Assert
      expect(result).toEqual({
        apexType: ApexType.BOOLEAN,
        typeName: 'Boolean',
      })
    })

    it('Given unknown variable, When resolveType, Then returns null', () => {
      // Arrange
      const methodTypeTable = new Map<string, ApexMethod>([
        [
          'myMethod',
          {
            returnType: 'void',
            startLine: 1,
            endLine: 5,
            type: ApexType.VOID,
          },
        ],
      ])
      const variableScopes = new Map<string, Map<string, string>>([
        ['myMethod', new Map()],
      ])
      const registry = new TypeRegistry(
        methodTypeTable,
        variableScopes,
        new Map(),
        []
      )

      // Act
      const result = registry.resolveType('myMethod', 'unknownVar')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('resolveType with dotted expression', () => {
    it('Given dotted expression with known root variable, When resolveType, Then delegates to matcher for field type', () => {
      // Arrange
      const methodTypeTable = new Map<string, ApexMethod>([
        [
          'myMethod',
          {
            returnType: 'void',
            startLine: 1,
            endLine: 5,
            type: ApexType.VOID,
          },
        ],
      ])
      const variableScopes = new Map<string, Map<string, string>>([
        ['myMethod', new Map([['account', 'Account']])],
      ])
      const matcher: TypeMatcher = {
        matches: jest.fn().mockReturnValue(true),
        collect: jest.fn(),
        collectedTypes: new Set(),
        getFieldType: jest.fn().mockReturnValue(ApexType.STRING),
      }
      const registry = new TypeRegistry(
        methodTypeTable,
        variableScopes,
        new Map(),
        [matcher]
      )

      // Act
      const result = registry.resolveType('myMethod', 'account.Name')

      // Assert
      expect(result).toEqual({
        apexType: ApexType.STRING,
        typeName: 'String',
      })
      expect(matcher.getFieldType).toHaveBeenCalledWith('Account', 'Name')
    })

    it('Given dotted expression with root in class fields, When resolveType, Then resolves via class fields and matcher', () => {
      // Arrange
      const methodTypeTable = new Map<string, ApexMethod>([
        [
          'myMethod',
          {
            returnType: 'void',
            startLine: 1,
            endLine: 5,
            type: ApexType.VOID,
          },
        ],
      ])
      const classFields = new Map<string, string>([['contact', 'Contact']])
      const matcher: TypeMatcher = {
        matches: jest.fn().mockReturnValue(true),
        collect: jest.fn(),
        collectedTypes: new Set(),
        getFieldType: jest.fn().mockReturnValue(ApexType.STRING),
      }
      const registry = new TypeRegistry(
        methodTypeTable,
        new Map([['myMethod', new Map()]]),
        classFields,
        [matcher]
      )

      // Act
      const result = registry.resolveType('myMethod', 'contact.Email')

      // Assert
      expect(result).toEqual({
        apexType: ApexType.STRING,
        typeName: 'String',
      })
      expect(matcher.getFieldType).toHaveBeenCalledWith('Contact', 'Email')
    })

    it('Given dotted expression with unknown root, When resolveType, Then returns null', () => {
      // Arrange
      const registry = new TypeRegistry(
        new Map([
          [
            'myMethod',
            {
              returnType: 'void',
              startLine: 1,
              endLine: 5,
              type: ApexType.VOID,
            },
          ],
        ]),
        new Map([['myMethod', new Map()]]),
        new Map(),
        []
      )

      // Act
      const result = registry.resolveType('myMethod', 'unknown.Field')

      // Assert
      expect(result).toBeNull()
    })

    it('Given dotted expression where no matcher has getFieldType, When resolveType, Then returns null', () => {
      // Arrange
      const matcher: TypeMatcher = {
        matches: jest.fn().mockReturnValue(false),
        collect: jest.fn(),
        collectedTypes: new Set(),
      }
      const registry = new TypeRegistry(
        new Map([
          [
            'myMethod',
            {
              returnType: 'void',
              startLine: 1,
              endLine: 5,
              type: ApexType.VOID,
            },
          ],
        ]),
        new Map([['myMethod', new Map([['account', 'Account']])]]),
        new Map(),
        [matcher]
      )

      // Act
      const result = registry.resolveType('myMethod', 'account.Name')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('resolveType with method call expression', () => {
    it('Given method call expression, When resolveType, Then looks up return type of called method', () => {
      // Arrange
      const methodTypeTable = new Map<string, ApexMethod>([
        [
          'myMethod',
          {
            returnType: 'void',
            startLine: 1,
            endLine: 5,
            type: ApexType.VOID,
          },
        ],
        [
          'getTotal',
          {
            returnType: 'Decimal',
            startLine: 10,
            endLine: 15,
            type: ApexType.DECIMAL,
          },
        ],
      ])
      const registry = new TypeRegistry(
        methodTypeTable,
        new Map(),
        new Map(),
        []
      )

      // Act
      const result = registry.resolveType('myMethod', 'getTotal()')

      // Assert
      expect(result).toEqual({
        apexType: ApexType.DECIMAL,
        typeName: 'Decimal',
      })
    })

    it('Given method call expression with unknown method, When resolveType, Then returns null', () => {
      // Arrange
      const registry = new TypeRegistry(
        new Map([
          [
            'myMethod',
            {
              returnType: 'void',
              startLine: 1,
              endLine: 5,
              type: ApexType.VOID,
            },
          ],
        ]),
        new Map(),
        new Map(),
        []
      )

      // Act
      const result = registry.resolveType('myMethod', 'unknownMethod()')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('type classification', () => {
    it.each([
      ['void', ApexType.VOID],
      ['Boolean', ApexType.BOOLEAN],
      ['Integer', ApexType.INTEGER],
      ['Long', ApexType.LONG],
      ['Double', ApexType.DOUBLE],
      ['Decimal', ApexType.DECIMAL],
      ['String', ApexType.STRING],
      ['ID', ApexType.ID],
      ['Blob', ApexType.BLOB],
      ['Date', ApexType.DATE],
      ['DateTime', ApexType.DATETIME],
      ['Time', ApexType.TIME],
      ['SObject', ApexType.SOBJECT],
      ['Object', ApexType.OBJECT],
      ['List<String>', ApexType.LIST],
      ['String[]', ApexType.LIST],
      ['Set<Integer>', ApexType.SET],
      ['Map<String,Integer>', ApexType.MAP],
    ])('Given variable of type %s, When resolveType, Then classifies as %s', (typeName: string, expectedType: ApexType) => {
      // Arrange
      const variableScopes = new Map([['myMethod', new Map([['x', typeName]])]])
      const registry = new TypeRegistry(
        new Map([
          [
            'myMethod',
            {
              returnType: 'void',
              startLine: 1,
              endLine: 5,
              type: ApexType.VOID,
            },
          ],
        ]),
        variableScopes,
        new Map(),
        []
      )

      // Act
      const result = registry.resolveType('myMethod', 'x')

      // Assert
      expect(result).not.toBeNull()
      expect(result!.apexType).toBe(expectedType)
      expect(result!.typeName).toBe(typeName)
    })

    it('Given variable type matching a matcher, When resolveType, Then classifies as OBJECT', () => {
      // Arrange
      const matcher: TypeMatcher = {
        matches: jest.fn().mockReturnValue(true),
        collect: jest.fn(),
        collectedTypes: new Set(),
      }
      const variableScopes = new Map([
        ['myMethod', new Map([['acc', 'Account']])],
      ])
      const registry = new TypeRegistry(
        new Map([
          [
            'myMethod',
            {
              returnType: 'void',
              startLine: 1,
              endLine: 5,
              type: ApexType.VOID,
            },
          ],
        ]),
        variableScopes,
        new Map(),
        [matcher]
      )

      // Act
      const result = registry.resolveType('myMethod', 'acc')

      // Assert
      expect(result).toEqual({
        apexType: ApexType.OBJECT,
        typeName: 'Account',
      })
    })

    it('Given variable type not matching any known type or matcher, When resolveType, Then classifies as VOID', () => {
      // Arrange
      const matcher: TypeMatcher = {
        matches: jest.fn().mockReturnValue(false),
        collect: jest.fn(),
        collectedTypes: new Set(),
      }
      const variableScopes = new Map([
        ['myMethod', new Map([['x', 'UnknownType']])],
      ])
      const registry = new TypeRegistry(
        new Map([
          [
            'myMethod',
            {
              returnType: 'void',
              startLine: 1,
              endLine: 5,
              type: ApexType.VOID,
            },
          ],
        ]),
        variableScopes,
        new Map(),
        [matcher]
      )

      // Act
      const result = registry.resolveType('myMethod', 'x')

      // Assert
      expect(result).toEqual({
        apexType: ApexType.VOID,
        typeName: 'UnknownType',
      })
    })
  })
})
