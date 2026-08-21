import { Connection } from '@salesforce/core'
import { OrgSObjectSchemaProvider } from '../../../../src/adapter/org/orgSObjectSchemaProvider.js'
import { APEX_TYPE } from '../../../../src/type/ApexMethod.js'

// The org's own namespace, pinned to a single value for the whole suite: the
// field alias now strips this constructor-level namespace regardless of
// which sObject is being described, so a fixture's field prefix either
// equals it (own) or does not (foreign).
const ORG_NAMESPACE = 'namespaced'

describe('OrgSObjectSchemaProvider', () => {
  let connectionStub: Connection
  let sut: OrgSObjectSchemaProvider
  const describeMock = vi.fn()
  const notifyMock = vi.fn()

  beforeEach(() => {
    connectionStub = {
      describe: describeMock,
    } as unknown as Connection
    sut = new OrgSObjectSchemaProvider(
      connectionStub,
      notifyMock,
      ORG_NAMESPACE
    )
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

    it('Given two sObjects failing with the same error message, When describing, Then notify is called once with both names and that error', async () => {
      // Arrange
      const sharedError = new Error('Object not found')
      describeMock
        .mockRejectedValueOnce(sharedError)
        .mockRejectedValueOnce(new Error('Object not found'))
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
        error: sharedError,
      })
      expect(sut.resolveFieldType('contact', 'name')).toBe(APEX_TYPE.STRING)
    })

    it('Given two sObjects failing with different error messages, When describing, Then notify is called once per distinct cause, each carrying only its own name', async () => {
      // Arrange — collapsing both causes onto the first would make the
      // second cause untraceable.
      const firstError = new Error('Object not found: BadA')
      const secondError = new Error('insufficient access: BadB')
      describeMock
        .mockRejectedValueOnce(firstError)
        .mockRejectedValueOnce(secondError)

      // Act
      await sut.describe(['BadA', 'BadB'])

      // Assert
      expect(notifyMock).toHaveBeenCalledTimes(2)
      expect(notifyMock).toHaveBeenCalledWith({
        kind: 'type-resolution-degraded',
        typeNames: ['BadA'],
        error: firstError,
      })
      expect(notifyMock).toHaveBeenCalledWith({
        kind: 'type-resolution-degraded',
        typeNames: ['BadB'],
        error: secondError,
      })
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

  describe("Given a describe result naming a field with the org's own namespace", () => {
    // A non-namespaced org has no namespace of its own, so no field can ever
    // be "own-namespace" — every local field's own spelling already is its
    // source spelling, and nothing should be aliased.
    it('Given a non-namespaced org describing a field whose name happens to look namespace-prefixed, When resolving the stripped spelling, Then no alias is minted', async () => {
      // Arrange
      const nonNamespacedSut = new OrgSObjectSchemaProvider(
        connectionStub,
        notifyMock,
        null
      )
      describeMock.mockResolvedValue({
        fields: [{ name: 'foo__Amount__c', type: 'double' }],
      })

      // Act
      await nonNamespacedSut.describe(['ProbeObj__c'])

      // Assert
      expect(
        nonNamespacedSut.resolveFieldType('ProbeObj__c', 'foo__Amount__c')
      ).toBe(APEX_TYPE.DOUBLE)
      expect(
        nonNamespacedSut.resolveFieldType('ProbeObj__c', 'Amount__c')
      ).toBeUndefined()
    })

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

    // The alias now strips the ORG's own namespace rather than the described
    // object's, so an own-namespace field resolves bare wherever it lives —
    // including on a standard object, which never itself carries a
    // namespace.
    it("Given a describe result on a standard object naming a field with the org's own namespace, When resolving the bare spelling, Then it resolves", async () => {
      // Arrange
      describeMock.mockResolvedValue({
        fields: [{ name: 'namespaced__Amount__c', type: 'double' }],
      })

      // Act
      await sut.describe(['Account'])

      // Assert
      expect(sut.resolveFieldType('Account', 'Amount__c')).toBe(
        APEX_TYPE.DOUBLE
      )
    })

    // A foreign package's field must always be written qualified: minting a
    // bare alias for it would create a false match against an unrelated
    // local field of the same bare name.
    it("Given a describe result naming a field with a foreign package's namespace, When resolving the bare spelling, Then it mints no alias while the qualified spelling still resolves", async () => {
      // Arrange
      describeMock.mockResolvedValue({
        fields: [{ name: 'devedapp__Amount__c', type: 'double' }],
      })

      // Act
      await sut.describe(['Account'])

      // Assert
      expect(sut.resolveFieldType('Account', 'devedapp__Amount__c')).toBe(
        APEX_TYPE.DOUBLE
      )
      expect(sut.resolveFieldType('Account', 'Amount__c')).toBeUndefined()
    })

    it("Given a describe result naming a field on an object that does not carry the org's own namespace prefix, When resolving under its own name, Then it resolves and gains no alias", async () => {
      // Arrange — a field name that does not start with the org's own
      // namespace must fail closed rather than mangle the field name.
      describeMock.mockResolvedValue({
        fields: [{ name: 'LocalField__c', type: 'string' }],
      })

      // Act
      await sut.describe(['namespaced__ProbeObj__c'])

      // Assert
      expect(
        sut.resolveFieldType('namespaced__ProbeObj__c', 'LocalField__c')
      ).toBe(APEX_TYPE.STRING)
      // Slicing anyway, ignoring the failed startsWith check, would mangle
      // 'localfield__c' into the single-character key 'c'.
      expect(
        sut.resolveFieldType('namespaced__ProbeObj__c', 'c')
      ).toBeUndefined()
    })

    it('Given a describe result naming a standard field, When resolving under its own name, Then it resolves', async () => {
      // Arrange
      describeMock.mockResolvedValue({
        fields: [{ name: 'Name', type: 'string' }],
      })

      // Act
      await sut.describe(['Account'])

      // Assert
      expect(sut.resolveFieldType('account', 'Name')).toBe(APEX_TYPE.STRING)
    })

    it('Given a describe result naming a non-namespaced custom field, When resolving under its own name, Then it resolves', async () => {
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

    // The geolocation-compound-field pair below is the motivating case for
    // deriving the alias from a known namespace: a compound component name
    // (`Loc__Latitude__s`) carries an extra `__` segment the developer name
    // never had, which broke counting segments to decide "namespaced" — it
    // fired for a non-namespaced field and missed firing for a namespaced
    // one.
    it('Given a describe result naming a geolocation component field with no namespace prefix, When resolving the field, Then it resolves under its own spelling and mints no alias for its middle segment', async () => {
      // Arrange
      describeMock.mockResolvedValue({
        fields: [{ name: 'Loc__Latitude__s', type: 'double' }],
      })

      // Act
      await sut.describe(['ProbeObj__c'])

      // Assert
      expect(sut.resolveFieldType('ProbeObj__c', 'Loc__Latitude__s')).toBe(
        APEX_TYPE.DOUBLE
      )
      expect(sut.resolveFieldType('ProbeObj__c', 'Latitude__s')).toBeUndefined()
    })

    it("Given a describe result naming a geolocation component field with the org's own namespace prefix, When resolving the namespace-stripped spelling, Then it resolves", async () => {
      // Arrange — this is the real spelling source inside the org's own
      // namespace writes; segment counting left it unresolved because the
      // component name carries four segments instead of three.
      describeMock.mockResolvedValue({
        fields: [{ name: 'namespaced__Loc__Latitude__s', type: 'double' }],
      })

      // Act
      await sut.describe(['namespaced__Loc__c'])

      // Assert
      expect(
        sut.resolveFieldType('namespaced__Loc__c', 'Loc__Latitude__s')
      ).toBe(APEX_TYPE.DOUBLE)
    })
  })

  describe('Given a describe result carrying both a real field and a namespaced field aliasing to the same bare spelling', () => {
    it('Given a describe result on an own-namespace object carrying both a real Amount__c and namespaced__Amount__c, When resolving Amount__c, Then the real field wins', async () => {
      // Arrange — deleting the collision guard makes this test observe
      // DOUBLE (the alias-derived value) instead of STRING (the real field).
      describeMock.mockResolvedValue({
        fields: [
          { name: 'Amount__c', type: 'string' },
          { name: 'namespaced__Amount__c', type: 'double' },
        ],
      })

      // Act
      await sut.describe(['namespaced__ProbeObj__c'])

      // Assert
      expect(sut.resolveFieldType('namespaced__ProbeObj__c', 'Amount__c')).toBe(
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
