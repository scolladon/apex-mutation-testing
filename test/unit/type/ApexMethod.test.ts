import {
  APEX_TYPE,
  type ApexType,
  getDefaultValueForApexType,
} from '../../../src/type/ApexMethod.js'

describe('getDefaultValueForApexType', () => {
  describe('primitive types', () => {
    it.each([
      { apexType: APEX_TYPE.STRING, expected: "''" },
      { apexType: APEX_TYPE.ID, expected: "''" },
      { apexType: APEX_TYPE.INTEGER, expected: '0' },
      { apexType: APEX_TYPE.LONG, expected: '0L' },
      { apexType: APEX_TYPE.DOUBLE, expected: '0.0' },
      { apexType: APEX_TYPE.DECIMAL, expected: '0.0' },
      { apexType: APEX_TYPE.BOOLEAN, expected: 'false' },
      { apexType: APEX_TYPE.BLOB, expected: "Blob.valueOf('')" },
    ])('Given $apexType type, When getting default value, Then returns $expected', ({
      apexType,
      expected,
    }) => {
      // Arrange & Act
      const result = getDefaultValueForApexType(apexType)

      // Assert
      expect(result).toBe(expected)
    })
  })

  describe('collection types with typeName', () => {
    it.each([
      {
        apexType: APEX_TYPE.LIST,
        typeName: 'List<String>',
        expected: 'new List<String>()',
      },
      {
        apexType: APEX_TYPE.SET,
        typeName: 'Set<Integer>',
        expected: 'new Set<Integer>()',
      },
      {
        apexType: APEX_TYPE.MAP,
        typeName: 'Map<String, Integer>',
        expected: 'new Map<String, Integer>()',
      },
    ])('Given $apexType type with typeName, When getting default value, Then returns new instance', ({
      apexType,
      typeName,
      expected,
    }) => {
      // Arrange & Act
      const result = getDefaultValueForApexType(apexType, typeName)

      // Assert
      expect(result).toBe(expected)
    })
  })

  it('Given SOBJECT type with typeName, When getting default value, Then returns new instance', () => {
    // Arrange & Act
    const result = getDefaultValueForApexType(APEX_TYPE.SOBJECT, 'Account')

    // Assert
    expect(result).toBe('new Account()')
  })

  it('Given SOBJECT type without typeName, When getting default value, Then returns null', () => {
    // Arrange & Act
    const result = getDefaultValueForApexType(APEX_TYPE.SOBJECT)

    // Assert
    expect(result).toBeNull()
  })

  it('Given LIST type without typeName, When getting default value, Then returns null', () => {
    // Arrange & Act
    const result = getDefaultValueForApexType(APEX_TYPE.LIST)

    // Assert
    expect(result).toBeNull()
  })

  it('Given SET type without typeName, When getting default value, Then returns null', () => {
    // Arrange & Act
    const result = getDefaultValueForApexType(APEX_TYPE.SET)

    // Assert
    expect(result).toBeNull()
  })

  it('Given MAP type without typeName, When getting default value, Then returns null', () => {
    // Arrange & Act
    const result = getDefaultValueForApexType(APEX_TYPE.MAP)

    // Assert
    expect(result).toBeNull()
  })

  it('Given unknown type, When getting default value, Then returns null', () => {
    // Arrange & Act
    const result = getDefaultValueForApexType('UNKNOWN_TYPE' as ApexType)

    // Assert
    expect(result).toBeNull()
  })

  describe('types that return null via default case', () => {
    it.each([
      { apexType: APEX_TYPE.VOID, label: 'VOID' },
      { apexType: APEX_TYPE.DATE, label: 'DATE' },
      { apexType: APEX_TYPE.DATETIME, label: 'DATETIME' },
      { apexType: APEX_TYPE.TIME, label: 'TIME' },
      { apexType: APEX_TYPE.OBJECT, label: 'OBJECT' },
      { apexType: APEX_TYPE.APEX_CLASS, label: 'APEX_CLASS' },
    ])('Given $label type, When getting default value, Then returns null', ({
      apexType,
    }) => {
      // Arrange & Act
      const result = getDefaultValueForApexType(apexType)

      // Assert — these types have no default literal value and fall through to return null
      expect(result).toBeNull()
    })
  })
})
