import type { Connection } from '@salesforce/core'
import { FlowTestDiscovery } from '../../../../src/adapter/org/flowTestDiscovery.js'

describe('FlowTestDiscovery', () => {
  const request = vi.fn()
  const connection = {
    tooling: { request },
    getApiVersion: () => '66.0',
  } as unknown as Connection
  const sut = new FlowTestDiscovery(connection)

  it('Given several pages, When listing, Then only this flow’s tests are returned, named exactly as reported', async () => {
    // Arrange — the shape observed on a sandbox: the method name is the
    // FlowTest's DeveloperName, which here starts with the flow's name
    request
      .mockResolvedValueOnce({
        apexTestClasses: [
          {
            id: '',
            name: 'Account_After',
            namespacePrefix: 'flowtesting',
            testMethods: [
              { name: 'Account_After_Sets_Rating' },
              { name: 'Unprefixed' },
            ],
          },
          { name: 'Other_Flow', testMethods: [{ name: 'Other_Flow_T' }] },
        ],
        nextRecordsUrl: '/services/data/v66.0/tooling/tests?page=2',
      })
      .mockResolvedValueOnce({
        apexTestClasses: [{ name: 'Account_After' }],
        nextRecordsUrl: null,
      })

    // Act
    const result = await sut.listTestNames('Account_After')

    // Assert
    expect(result).toEqual(['Account_After_Sets_Rating', 'Unprefixed'])
    expect(request).toHaveBeenNthCalledWith(
      1,
      '/services/data/v66.0/tooling/tests?category=flow'
    )
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/services/data/v66.0/tooling/tests?page=2'
    )
  })

  it('Given the flow named in another case, When listing, Then its tests are returned as the org names them', async () => {
    // Arrange
    request.mockResolvedValueOnce({
      apexTestClasses: [
        { name: 'Account_After', testMethods: [{ name: 'Sets_Rating' }] },
      ],
    })

    // Act & Assert
    await expect(sut.listTestNames('ACCOUNT_after')).resolves.toEqual([
      'Sets_Rating',
    ])
  })

  it('Given a page without test classes, When listing, Then nothing is returned', async () => {
    // Arrange
    request.mockResolvedValueOnce({})

    // Act & Assert
    await expect(sut.listTestNames('Account_After')).resolves.toEqual([])
  })
})
