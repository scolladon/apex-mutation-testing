import { Connection } from '@salesforce/core'
import { OrganizationRepository } from '../../../../src/adapter/org/organizationRepository.js'

describe('OrganizationRepository', () => {
  let connectionStub: Connection
  let sut: OrganizationRepository
  const queryMock = vi.fn()

  beforeEach(() => {
    connectionStub = {
      query: queryMock,
    } as unknown as Connection
    sut = new OrganizationRepository(connectionStub)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('when reading the org namespace prefix', () => {
    it('Given a namespaced org, When reading the namespace prefix, Then it resolves the prefix through a plain, non-Tooling query', async () => {
      // Arrange
      queryMock.mockResolvedValue({
        records: [{ NamespacePrefix: 'namespaced' }],
      })

      // Act
      const result = await sut.readNamespacePrefix()

      // Assert
      expect(result).toBe('namespaced')
      expect(queryMock).toHaveBeenCalledWith(
        'SELECT NamespacePrefix FROM Organization'
      )
    })

    it('Given a non-namespaced org, When reading the namespace prefix, Then it resolves null', async () => {
      // Arrange
      queryMock.mockResolvedValue({ records: [{ NamespacePrefix: null }] })

      // Act
      const result = await sut.readNamespacePrefix()

      // Assert
      expect(result).toBeNull()
    })

    it('Given the query returns no Organization row, When reading the namespace prefix, Then it resolves null rather than throwing', async () => {
      // Arrange
      queryMock.mockResolvedValue({ records: [] })

      // Act
      const result = await sut.readNamespacePrefix()

      // Assert
      expect(result).toBeNull()
    })

    // isOwnNamespace's folding treats '' and null as the same "no namespace"
    // value, so the read must normalise '' to null at the source rather than
    // preserving a distinction nothing downstream honours.
    it('Given the org reports an empty-string namespace prefix, When reading the namespace prefix, Then it resolves null', async () => {
      // Arrange
      queryMock.mockResolvedValue({ records: [{ NamespacePrefix: '' }] })

      // Act
      const result = await sut.readNamespacePrefix()

      // Assert
      expect(result).toBeNull()
    })
  })
})
