import { Connection } from '@salesforce/core'
import { SObjectDescribeRepository } from '../../../src/adapter/sObjectDescribeRepository.js'
import { APEX_TYPE } from '../../../src/type/ApexMethod.js'

describe('SObjectDescribeRepository', () => {
  let connectionStub: Connection
  let sut: SObjectDescribeRepository
  const describeMock = jest.fn()

  beforeEach(() => {
    connectionStub = {
      describe: describeMock,
    } as unknown as Connection
    sut = new SObjectDescribeRepository(connectionStub)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Given describe is called with sObject names', () => {
    it('Then should call connection.describe for each sObject', async () => {
      // Arrange
      describeMock.mockResolvedValue({ fields: [] })

      // Act
      await sut.describe(['Account', 'Contact'])

      // Assert
      expect(describeMock).toHaveBeenCalledTimes(2)
      expect(describeMock).toHaveBeenCalledWith('Account')
      expect(describeMock).toHaveBeenCalledWith('Contact')
    })

    it('Then should store field types from describe results', async () => {
      // Arrange
      describeMock.mockResolvedValue({
        fields: [
          { name: 'Name', type: 'string' },
          { name: 'NumberOfEmployees', type: 'int' },
          { name: 'AnnualRevenue', type: 'currency' },
          { name: 'BillingLatitude', type: 'double' },
          { name: 'CreatedDate', type: 'datetime' },
          { name: 'IsDeleted', type: 'boolean' },
          { name: 'OwnerId', type: 'reference' },
          { name: 'Phone', type: 'phone' },
          { name: 'Website', type: 'url' },
          { name: 'Industry', type: 'picklist' },
          { name: 'Ownership', type: 'percent' },
          { name: 'BillingAddress', type: 'address' },
        ],
      })

      // Act
      await sut.describe(['Account'])

      // Assert
      expect(sut.resolveFieldType('account', 'name')).toBe(APEX_TYPE.STRING)
      expect(sut.resolveFieldType('account', 'numberofemployees')).toBe(
        APEX_TYPE.INTEGER
      )
      expect(sut.resolveFieldType('account', 'annualrevenue')).toBe(
        APEX_TYPE.DECIMAL
      )
      expect(sut.resolveFieldType('account', 'billinglatitude')).toBe(
        APEX_TYPE.DOUBLE
      )
      expect(sut.resolveFieldType('account', 'createddate')).toBe(
        APEX_TYPE.DATETIME
      )
      expect(sut.resolveFieldType('account', 'isdeleted')).toBe(
        APEX_TYPE.BOOLEAN
      )
      expect(sut.resolveFieldType('account', 'ownerid')).toBe(APEX_TYPE.ID)
      expect(sut.resolveFieldType('account', 'phone')).toBe(APEX_TYPE.STRING)
      expect(sut.resolveFieldType('account', 'website')).toBe(APEX_TYPE.STRING)
      expect(sut.resolveFieldType('account', 'industry')).toBe(APEX_TYPE.STRING)
      expect(sut.resolveFieldType('account', 'ownership')).toBe(
        APEX_TYPE.DOUBLE
      )
      expect(sut.resolveFieldType('account', 'billingaddress')).toBe(
        APEX_TYPE.OBJECT
      )
    })

    it.each([
      ['id', APEX_TYPE.ID],
      ['date', APEX_TYPE.DATE],
      ['textarea', APEX_TYPE.STRING],
      ['email', APEX_TYPE.STRING],
      ['multipicklist', APEX_TYPE.STRING],
      ['encryptedstring', APEX_TYPE.STRING],
    ])('Then should map describe type "%s" to %s', async (describeType, expectedApexType) => {
      // Arrange
      describeMock.mockResolvedValue({
        fields: [{ name: 'TestField', type: describeType }],
      })

      // Act
      await sut.describe(['Account'])

      // Assert
      expect(sut.resolveFieldType('account', 'testfield')).toBe(
        expectedApexType
      )
    })
  })

  describe('Given a describe call fails for one sObject', () => {
    it('Then should skip that sObject and continue with others', async () => {
      // Arrange
      describeMock
        .mockRejectedValueOnce(new Error('Object not found'))
        .mockResolvedValueOnce({
          fields: [{ name: 'Name', type: 'string' }],
        })

      // Act
      await sut.describe(['BadObject', 'Contact'])

      // Assert
      expect(sut.isSObject('badobject')).toBe(false)
      expect(sut.isSObject('contact')).toBe(true)
      expect(sut.resolveFieldType('contact', 'name')).toBe(APEX_TYPE.STRING)
    })
  })

  describe('Given an empty sObject names list', () => {
    it('Then should not call connection.describe', async () => {
      // Act
      await sut.describe([])

      // Assert
      expect(describeMock).not.toHaveBeenCalled()
    })
  })

  describe('Given isSObject is called', () => {
    it('Then should return true for described sObjects', async () => {
      // Arrange
      describeMock.mockResolvedValue({ fields: [] })
      await sut.describe(['Account'])

      // Assert
      expect(sut.isSObject('account')).toBe(true)
    })

    it('Then should return false for unknown types', () => {
      expect(sut.isSObject('myclass')).toBe(false)
    })
  })

  describe('Given resolveFieldType is called', () => {
    it('Then should return undefined for unknown sObject', () => {
      expect(sut.resolveFieldType('unknown', 'field')).toBeUndefined()
    })

    it('Then should return undefined for unknown field on known sObject', async () => {
      // Arrange
      describeMock.mockResolvedValue({
        fields: [{ name: 'Name', type: 'string' }],
      })
      await sut.describe(['Account'])

      // Assert
      expect(sut.resolveFieldType('account', 'nonexistent')).toBeUndefined()
    })

    it('Then should be case-insensitive for both sObject and field names', async () => {
      // Arrange
      describeMock.mockResolvedValue({
        fields: [{ name: 'NumberOfEmployees', type: 'int' }],
      })
      await sut.describe(['Account'])

      // Assert
      expect(sut.resolveFieldType('account', 'numberofemployees')).toBe(
        APEX_TYPE.INTEGER
      )
      expect(sut.resolveFieldType('ACCOUNT', 'NUMBEROFEMPLOYEES')).toBe(
        APEX_TYPE.INTEGER
      )
    })

    it('Then should map unknown describe types to OBJECT', async () => {
      // Arrange
      describeMock.mockResolvedValue({
        fields: [{ name: 'Custom', type: 'somefuturetype' }],
      })
      await sut.describe(['Account'])

      // Assert
      expect(sut.resolveFieldType('account', 'custom')).toBe(APEX_TYPE.OBJECT)
    })
  })
})
