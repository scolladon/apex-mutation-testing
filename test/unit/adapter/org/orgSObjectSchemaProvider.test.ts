import { Connection } from '@salesforce/core'
import { OrgSObjectSchemaProvider } from '../../../../src/adapter/org/orgSObjectSchemaProvider.js'
import { APEX_TYPE } from '../../../../src/type/ApexMethod.js'

describe('OrgSObjectSchemaProvider', () => {
  let connectionStub: Connection
  let sut: OrgSObjectSchemaProvider
  const describeMock = vi.fn()
  const notifyMock = vi.fn()

  beforeEach(() => {
    connectionStub = {
      describe: describeMock,
    } as unknown as Connection
    sut = new OrgSObjectSchemaProvider(connectionStub, notifyMock)
  })

  afterEach(() => {
    vi.clearAllMocks()
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
    ])(
      'Then should map describe type "%s" to %s',
      async (describeType, expectedApexType) => {
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
      }
    )
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
      expect(sut.resolveFieldType('contact', 'name')).toBe(APEX_TYPE.STRING)
    })

    it('Then the surviving object still resolves and notify is called exactly once with both failed names and the first error', async () => {
      // Arrange
      const firstError = new Error('Object not found: BadA')
      const secondError = new Error('Object not found: BadB')
      describeMock
        .mockRejectedValueOnce(firstError)
        .mockRejectedValueOnce(secondError)
        .mockResolvedValueOnce({
          fields: [{ name: 'Name', type: 'string' }],
        })

      // Act
      await sut.describe(['BadA', 'BadB', 'Contact'])

      // Assert
      expect(notifyMock).toHaveBeenCalledTimes(1)
      expect(notifyMock).toHaveBeenCalledWith({
        kind: 'type-resolution-degraded',
        typeNames: ['BadA', 'BadB'],
        error: firstError,
      })
      expect(sut.resolveFieldType('contact', 'name')).toBe(APEX_TYPE.STRING)
    })

    it('Given a describe rejects with a non-Error value, When describing, Then the notice still carries an Error carrying that value', async () => {
      // Arrange — a non-Error rejection value drives the false arm of the
      // instanceof normalisation
      describeMock.mockRejectedValueOnce('boom')

      // Act
      await sut.describe(['BadObject'])

      // Assert
      const [notice] = notifyMock.mock.calls[0] as [
        { error?: Error; typeNames: string[] },
      ]
      expect(notice.error).toBeInstanceOf(Error)
      expect(notice.error?.message).toContain('boom')
    })

    it('Given every describe succeeds, When describing, Then notify is never called', async () => {
      // Arrange
      describeMock.mockResolvedValue({ fields: [] })

      // Act
      await sut.describe(['Account', 'Contact'])

      // Assert
      expect(notifyMock).not.toHaveBeenCalled()
    })
  })

  describe('Given a describe result naming a field with its namespaced spelling', () => {
    it('Given a describe result naming a field namespaced__Amount__c, When resolving Amount__c, Then it returns DOUBLE', async () => {
      // Arrange
      describeMock.mockResolvedValue({
        fields: [{ name: 'namespaced__Amount__c', type: 'double' }],
      })

      // Act
      await sut.describe(['namespaced__ProbeObj__c'])

      // Assert
      expect(sut.resolveFieldType('namespaced__ProbeObj__c', 'Amount__c')).toBe(
        APEX_TYPE.DOUBLE
      )
    })

    it('Given a describe result naming a standard field, When resolving under its own name, Then it resolves and gains no spurious alias', async () => {
      // Arrange
      describeMock.mockResolvedValue({
        fields: [{ name: 'Name', type: 'string' }],
      })

      // Act
      await sut.describe(['Account'])

      // Assert
      expect(sut.resolveFieldType('account', 'Name')).toBe(APEX_TYPE.STRING)
    })

    it('Given a describe result naming a non-namespaced custom field, When resolving under its own name, Then it resolves and gains no spurious alias', async () => {
      // Arrange
      describeMock.mockResolvedValue({
        fields: [{ name: 'Amount__c', type: 'double' }],
      })

      // Act
      await sut.describe(['ProbeObj__c'])

      // Assert
      expect(sut.resolveFieldType('ProbeObj__c', 'Amount__c')).toBe(
        APEX_TYPE.DOUBLE
      )
    })
  })

  describe('Given a describe result carrying both a real field and a packaged field aliasing to the same bare spelling', () => {
    it('Given a describe result carrying both a real Amount__c and a packaged pkg__Amount__c, When resolving Amount__c, Then the real field wins', async () => {
      // Arrange
      describeMock.mockResolvedValue({
        fields: [
          { name: 'Amount__c', type: 'string' },
          { name: 'pkg__Amount__c', type: 'double' },
        ],
      })

      // Act
      await sut.describe(['ProbeObj__c'])

      // Assert
      expect(sut.resolveFieldType('ProbeObj__c', 'Amount__c')).toBe(
        APEX_TYPE.STRING
      )
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
