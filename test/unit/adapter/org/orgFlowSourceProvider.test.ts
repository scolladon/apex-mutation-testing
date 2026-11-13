import type { FlowMetadataRepository } from '../../../../src/adapter/org/flowMetadataRepository.js'
import type { FlowTestDiscovery } from '../../../../src/adapter/org/flowTestDiscovery.js'
import {
  OrgFlowSourceProvider,
  toFlowTestName,
} from '../../../../src/adapter/org/orgFlowSourceProvider.js'
import {
  FlowNotFoundError,
  FlowTestNotFoundError,
  NoFlowTestsError,
} from '../../../../src/port/flowErrors.js'
import {
  flowTestXml,
  recordTriggeredFlowXml,
} from '../../../utils/flowFixtures.js'

describe('OrgFlowSourceProvider', () => {
  const retrieve = vi.fn()
  const listTestNames = vi.fn()
  const sut = new OrgFlowSourceProvider(
    { retrieve } as unknown as FlowMetadataRepository,
    { listTestNames } as unknown as FlowTestDiscovery
  )
  const flowFile = {
    type: 'Flow',
    fullName: 'Account_After',
    xml: recordTriggeredFlowXml(),
  }
  const testFile = (fullName: string, flow = 'Account_After') => ({
    type: 'FlowTest',
    fullName,
    xml: flowTestXml(flow),
  })

  it('Given no test names, When reading, Then the discovered FlowTests are retrieved with the flow', async () => {
    // Arrange
    listTestNames.mockResolvedValue(['Sets_Rating'])
    retrieve.mockResolvedValue([flowFile, testFile('Sets_Rating')])

    // Act
    const result = await sut.readFlow('Account_After')

    // Assert
    expect(retrieve).toHaveBeenCalledWith([
      { type: 'Flow', fullNames: ['Account_After'] },
      { type: 'FlowTest', fullNames: ['Sets_Rating'] },
    ])
    expect(result).toEqual({
      apiName: 'Account_After',
      xml: recordTriggeredFlowXml(),
      tests: [{ fullName: 'Sets_Rating', xml: flowTestXml('Account_After') }],
    })
  })

  it('Given test names in any spelling, When reading, Then they are normalised and discovery is skipped', async () => {
    // Arrange
    retrieve.mockResolvedValue([
      flowFile,
      testFile('A'),
      testFile('B'),
      testFile('C'),
    ])

    // Act
    await sut.readFlow('Account_After', [
      'FlowTesting.Account_After.A',
      'Account_After.B',
      'C',
    ])

    // Assert
    expect(listTestNames).not.toHaveBeenCalled()
    expect(retrieve.mock.calls[0][0][1]).toEqual({
      type: 'FlowTest',
      fullNames: ['A', 'B', 'C'],
    })
  })

  it('Given a flow without FlowTest, When reading, Then it refuses before any retrieve', async () => {
    // Arrange
    listTestNames.mockResolvedValue([])

    // Act & Assert
    await expect(sut.readFlow('Account_After')).rejects.toEqual(
      new NoFlowTestsError('Account_After')
    )
    expect(retrieve).not.toHaveBeenCalled()
  })

  it('Given the flow missing from the retrieve, When reading, Then it throws FlowNotFoundError', async () => {
    // Arrange
    retrieve.mockResolvedValue([testFile('A')])

    // Act & Assert
    await expect(sut.readFlow('Account_After', ['A'])).rejects.toEqual(
      new FlowNotFoundError('Account_After')
    )
  })

  it('Given a requested FlowTest missing or belonging to another flow, When reading, Then it is reported as not found', async () => {
    // Arrange
    retrieve.mockResolvedValue([
      flowFile,
      testFile('A'),
      testFile('B', 'Other'),
    ])

    // Act & Assert
    await expect(
      sut.readFlow('Account_After', ['A', 'B', 'C'])
    ).rejects.toEqual(new FlowTestNotFoundError('Account_After', ['B', 'C']))
  })

  it('Given a FlowTest sharing the flow name and another Flow, When reading, Then the Flow of that name is the source', async () => {
    // Arrange
    retrieve.mockResolvedValue([
      testFile('Account_After'),
      { type: 'Flow', fullName: 'Other', xml: '<Flow/>' },
      flowFile,
      testFile('A'),
    ])

    // Act
    const result = await sut.readFlow('Account_After', ['A'])

    // Assert
    expect(result.xml).toBe(recordTriggeredFlowXml())
    expect(result.tests.map(test => test.fullName)).toEqual(['A'])
  })

  it('Given a test name of another flow, When normalised, Then it is left as is', () => {
    // Act & Assert
    expect(toFlowTestName('Other.T', 'Account_After')).toBe('Other.T')
  })
})
