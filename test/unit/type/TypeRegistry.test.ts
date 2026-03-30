import { TypeMatcher } from '../../../src/service/typeMatcher.js'
import type { ApexMethod } from '../../../src/type/ApexMethod.js'
import { APEX_TYPE, ApexType } from '../../../src/type/ApexMethod.js'
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
            type: APEX_TYPE.INTEGER,
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
        apexType: APEX_TYPE.INTEGER,
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
            type: APEX_TYPE.LIST,
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
        apexType: APEX_TYPE.LIST,
        typeName: 'List<String>',
        elementType: 'String',
      })
    })

    it('Given method without elementType, When resolveType, Then result does NOT contain elementType property', () => {
      // Arrange — kills "remove if guard" mutant that always sets result.elementType
      const methodTypeTable = new Map<string, ApexMethod>([
        [
          'myMethod',
          {
            returnType: 'Integer',
            startLine: 1,
            endLine: 5,
            type: APEX_TYPE.INTEGER,
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

      // Assert — explicitly verify no elementType key exists (undefined !== absent)
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('elementType')
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
            type: APEX_TYPE.VOID,
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
        apexType: APEX_TYPE.STRING,
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
            type: APEX_TYPE.VOID,
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
        apexType: APEX_TYPE.BOOLEAN,
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
            type: APEX_TYPE.VOID,
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
            type: APEX_TYPE.VOID,
          },
        ],
      ])
      const variableScopes = new Map<string, Map<string, string>>([
        ['myMethod', new Map([['account', 'Account']])],
      ])
      const matcher: TypeMatcher = {
        matches: vi.fn().mockReturnValue(true),
        collect: vi.fn(),
        collectedTypes: new Set(),
        getFieldType: vi.fn().mockReturnValue(APEX_TYPE.STRING),
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
        apexType: APEX_TYPE.STRING,
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
            type: APEX_TYPE.VOID,
          },
        ],
      ])
      const classFields = new Map<string, string>([['contact', 'Contact']])
      const matcher: TypeMatcher = {
        matches: vi.fn().mockReturnValue(true),
        collect: vi.fn(),
        collectedTypes: new Set(),
        getFieldType: vi.fn().mockReturnValue(APEX_TYPE.STRING),
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
        apexType: APEX_TYPE.STRING,
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
              type: APEX_TYPE.VOID,
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

    it('Given dotted expression where fieldType has no name mapping, When resolveType, Then falls back to rootType as typeName', () => {
      // Arrange
      const matcher: TypeMatcher = {
        matches: vi.fn().mockReturnValue(true),
        collect: vi.fn(),
        collectedTypes: new Set(),
        getFieldType: vi.fn().mockReturnValue('UNMAPPED_TYPE' as ApexType),
      }
      const registry = new TypeRegistry(
        new Map([
          [
            'myMethod',
            {
              returnType: 'void',
              startLine: 1,
              endLine: 5,
              type: APEX_TYPE.VOID,
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
      expect(result).toEqual({
        apexType: 'UNMAPPED_TYPE',
        typeName: 'Account',
      })
    })

    it('Given dotted expression where getFieldType returns undefined, When resolveType, Then returns null', () => {
      // Arrange
      const matcher: TypeMatcher = {
        matches: vi.fn().mockReturnValue(true),
        collect: vi.fn(),
        collectedTypes: new Set(),
        getFieldType: vi.fn().mockReturnValue(undefined),
      }
      const registry = new TypeRegistry(
        new Map([
          [
            'myMethod',
            {
              returnType: 'void',
              startLine: 1,
              endLine: 5,
              type: APEX_TYPE.VOID,
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

    it('Given dotted expression where no matcher has getFieldType, When resolveType, Then returns null', () => {
      // Arrange
      const matcher: TypeMatcher = {
        matches: vi.fn().mockReturnValue(false),
        collect: vi.fn(),
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
              type: APEX_TYPE.VOID,
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
            type: APEX_TYPE.VOID,
          },
        ],
        [
          'getTotal',
          {
            returnType: 'Decimal',
            startLine: 10,
            endLine: 15,
            type: APEX_TYPE.DECIMAL,
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
        apexType: APEX_TYPE.DECIMAL,
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
              type: APEX_TYPE.VOID,
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

  describe('isNumericOperand', () => {
    it.each([
      'Integer',
      'Long',
      'Double',
      'Decimal',
    ])('Given variable of numeric type %s, When isNumericOperand, Then returns true', (typeName: string) => {
      // Arrange
      const registry = new TypeRegistry(
        new Map(),
        new Map([['myMethod', new Map([['n', typeName]])]]),
        new Map(),
        []
      )

      // Act & Assert
      expect(registry.isNumericOperand('myMethod', 'n')).toBe(true)
    })

    it.each([
      'String',
      'Boolean',
      'Date',
      'DateTime',
      'Blob',
      'Id',
    ])('Given variable of non-numeric type %s, When isNumericOperand, Then returns false', (typeName: string) => {
      // Arrange
      const registry = new TypeRegistry(
        new Map(),
        new Map([['myMethod', new Map([['x', typeName]])]]),
        new Map(),
        []
      )

      // Act & Assert
      expect(registry.isNumericOperand('myMethod', 'x')).toBe(false)
    })

    it('Given string literal expression, When isNumericOperand, Then returns false', () => {
      // Arrange
      const registry = new TypeRegistry(new Map(), new Map(), new Map(), [])

      // Act & Assert
      expect(registry.isNumericOperand('myMethod', "'hello'")).toBe(false)
    })

    it('Given unresolvable expression, When isNumericOperand, Then returns true (permissive fallback)', () => {
      // Arrange
      const registry = new TypeRegistry(
        new Map(),
        new Map([['myMethod', new Map()]]),
        new Map(),
        []
      )

      // Act & Assert
      expect(registry.isNumericOperand('myMethod', 'unknownVar')).toBe(true)
    })
  })

  describe('isNumericReturn', () => {
    it.each([
      ['Integer', APEX_TYPE.INTEGER],
      ['Long', APEX_TYPE.LONG],
      ['Double', APEX_TYPE.DOUBLE],
      ['Decimal', APEX_TYPE.DECIMAL],
    ])('Given method returning %s, When isNumericReturn, Then returns true', (returnType: string, apexType: ApexType) => {
      // Arrange
      const registry = new TypeRegistry(
        new Map([
          [
            'myMethod',
            { returnType, startLine: 1, endLine: 5, type: apexType },
          ],
        ]),
        new Map(),
        new Map(),
        []
      )

      // Act & Assert
      expect(registry.isNumericReturn('myMethod')).toBe(true)
    })

    it.each([
      ['String', APEX_TYPE.STRING],
      ['Boolean', APEX_TYPE.BOOLEAN],
      ['void', APEX_TYPE.VOID],
    ])('Given method returning non-numeric type %s, When isNumericReturn, Then returns false', (returnType: string, apexType: ApexType) => {
      // Arrange
      const registry = new TypeRegistry(
        new Map([
          [
            'myMethod',
            { returnType, startLine: 1, endLine: 5, type: apexType },
          ],
        ]),
        new Map(),
        new Map(),
        []
      )

      // Act & Assert
      expect(registry.isNumericReturn('myMethod')).toBe(false)
    })

    it('Given unknown method, When isNumericReturn, Then returns false', () => {
      // Arrange
      const registry = new TypeRegistry(new Map(), new Map(), new Map(), [])

      // Act & Assert
      expect(registry.isNumericReturn('unknownMethod')).toBe(false)
    })
  })

  describe('PRIMITIVE_TYPE_MAP — each entry must be present', () => {
    it.each([
      ['void', APEX_TYPE.VOID],
      ['boolean', APEX_TYPE.BOOLEAN],
      ['integer', APEX_TYPE.INTEGER],
      ['long', APEX_TYPE.LONG],
      ['double', APEX_TYPE.DOUBLE],
      ['decimal', APEX_TYPE.DECIMAL],
      ['string', APEX_TYPE.STRING],
      ['id', APEX_TYPE.ID],
      ['blob', APEX_TYPE.BLOB],
      ['date', APEX_TYPE.DATE],
      ['datetime', APEX_TYPE.DATETIME],
      ['time', APEX_TYPE.TIME],
      ['sobject', APEX_TYPE.SOBJECT],
      ['object', APEX_TYPE.OBJECT],
    ])('Given %s primitive type name, When classifyApexType, Then returns %s (not the VOID fallback)', (typeName: string, expectedType: ApexType) => {
      // Arrange — use isNumericOperand: when type resolves to a known non-STRING type it returns a specific value.
      // We drive via resolveType with a variable whose type is the primitive name.
      const variableScopes = new Map([['m', new Map([['x', typeName]])]])
      const sut = new TypeRegistry(new Map(), variableScopes, new Map(), [])

      // Act
      const result = sut.resolveType('m', 'x')

      // Assert — result must not be null and the apexType must come from the map, not the VOID fallback
      expect(result).not.toBeNull()
      expect(result!.apexType).toBe(expectedType)
    })

    it('Given void type name with a matcher that would match anything, When classifyApexType, Then primitive map takes precedence and returns VOID not OBJECT', () => {
      // Arrange — a matcher that matches 'void' would return OBJECT if the primitive map entry is missing.
      // This test kills the ArrayDeclaration and StringLiteral mutants on the ['void', APEX_TYPE.VOID] entry.
      const greedyMatcher: TypeMatcher = {
        matches: vi.fn().mockReturnValue(true),
        collect: vi.fn(),
        collectedTypes: new Set(),
      }
      const variableScopes = new Map([['m', new Map([['x', 'void']])]])
      const sut = new TypeRegistry(new Map(), variableScopes, new Map(), [
        greedyMatcher,
      ])

      // Act
      const result = sut.resolveType('m', 'x')

      // Assert — VOID from the primitive map, NOT OBJECT from the matcher fallback
      expect(result).not.toBeNull()
      expect(result!.apexType).toBe(APEX_TYPE.VOID)
    })
  })

  describe('APEX_TYPE_TO_NAME map — each entry used in resolveDottedExpression', () => {
    it.each([
      [APEX_TYPE.VOID, 'void'],
      [APEX_TYPE.BOOLEAN, 'Boolean'],
      [APEX_TYPE.INTEGER, 'Integer'],
      [APEX_TYPE.LONG, 'Long'],
      [APEX_TYPE.DOUBLE, 'Double'],
      [APEX_TYPE.DECIMAL, 'Decimal'],
      [APEX_TYPE.STRING, 'String'],
      [APEX_TYPE.ID, 'ID'],
      [APEX_TYPE.BLOB, 'Blob'],
      [APEX_TYPE.DATE, 'Date'],
      [APEX_TYPE.DATETIME, 'DateTime'],
      [APEX_TYPE.TIME, 'Time'],
      [APEX_TYPE.SOBJECT, 'SObject'],
      [APEX_TYPE.OBJECT, 'Object'],
      [APEX_TYPE.LIST, 'List'],
      [APEX_TYPE.SET, 'Set'],
      [APEX_TYPE.MAP, 'Map'],
      [APEX_TYPE.APEX_CLASS, 'Object'],
    ])('Given field of ApexType %s, When resolveDottedExpression returns that type, Then typeName is %s', (fieldApexType: ApexType, expectedTypeName: string) => {
      // Arrange
      const matcher: TypeMatcher = {
        matches: vi.fn().mockReturnValue(true),
        collect: vi.fn(),
        collectedTypes: new Set(),
        getFieldType: vi.fn().mockReturnValue(fieldApexType),
      }
      const variableScopes = new Map([['m', new Map([['obj', 'SomeType']])]])
      const sut = new TypeRegistry(new Map(), variableScopes, new Map(), [
        matcher,
      ])

      // Act
      const result = sut.resolveType('m', 'obj.someField')

      // Assert
      expect(result).not.toBeNull()
      expect(result!.apexType).toBe(fieldApexType)
      expect(result!.typeName).toBe(expectedTypeName)
    })
  })

  describe('resolveDottedExpression — rootType guard', () => {
    it('Given dotted expression with unknown root and a matcher with getFieldType, When resolveType, Then returns null (guard prevents passing undefined to getFieldType)', () => {
      // Arrange
      const matcher: TypeMatcher = {
        matches: vi.fn().mockReturnValue(true),
        collect: vi.fn(),
        collectedTypes: new Set(),
        getFieldType: vi.fn().mockReturnValue(APEX_TYPE.STRING),
      }
      const sut = new TypeRegistry(
        new Map(),
        new Map([['m', new Map()]]),
        new Map(),
        [matcher]
      )

      // Act
      const result = sut.resolveType('m', 'unknownVar.someField')

      // Assert — if guard removed, getFieldType would be called with undefined
      expect(result).toBeNull()
      expect(matcher.getFieldType).not.toHaveBeenCalled()
    })
  })

  describe('type classification', () => {
    it.each([
      ['void', APEX_TYPE.VOID],
      ['Boolean', APEX_TYPE.BOOLEAN],
      ['Integer', APEX_TYPE.INTEGER],
      ['Long', APEX_TYPE.LONG],
      ['Double', APEX_TYPE.DOUBLE],
      ['Decimal', APEX_TYPE.DECIMAL],
      ['String', APEX_TYPE.STRING],
      ['ID', APEX_TYPE.ID],
      ['Blob', APEX_TYPE.BLOB],
      ['Date', APEX_TYPE.DATE],
      ['DateTime', APEX_TYPE.DATETIME],
      ['Time', APEX_TYPE.TIME],
      ['SObject', APEX_TYPE.SOBJECT],
      ['Object', APEX_TYPE.OBJECT],
      ['List<String>', APEX_TYPE.LIST],
      ['String[]', APEX_TYPE.LIST],
      ['Set<Integer>', APEX_TYPE.SET],
      ['Map<String,Integer>', APEX_TYPE.MAP],
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
              type: APEX_TYPE.VOID,
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
        matches: vi.fn().mockReturnValue(true),
        collect: vi.fn(),
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
              type: APEX_TYPE.VOID,
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
        apexType: APEX_TYPE.OBJECT,
        typeName: 'Account',
      })
    })

    it('Given variable type not matching any known type or matcher, When resolveType, Then classifies as VOID', () => {
      // Arrange
      const matcher: TypeMatcher = {
        matches: vi.fn().mockReturnValue(false),
        collect: vi.fn(),
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
              type: APEX_TYPE.VOID,
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
        apexType: APEX_TYPE.VOID,
        typeName: 'UnknownType',
      })
    })
  })
})
