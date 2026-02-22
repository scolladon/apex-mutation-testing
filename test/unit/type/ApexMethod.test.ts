import {
  APEX_TYPE,
  type ApexType,
  getDefaultValueForApexType,
} from '../../../src/type/ApexMethod.js'

describe('getDefaultValueForApexType', () => {
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
})
