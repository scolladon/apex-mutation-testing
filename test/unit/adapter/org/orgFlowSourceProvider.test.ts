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

  it('Given a flow without FlowTest, When reading, Then only the flow is retrieved and it refuses, naming the flow as the org spells it', async () => {
    // Arrange
    listTestNames.mockResolvedValue([])
    retrieve.mockResolvedValue([flowFile])

    // Act & Assert
    await expect(sut.readFlow('account_after')).rejects.toEqual(
      new NoFlowTestsError('Account_After')
    )
    expect(retrieve).toHaveBeenCalledTimes(1)
    expect(retrieve).toHaveBeenCalledWith([
      { type: 'Flow', fullNames: ['account_after'] },
    ])
  })

  it('Given a flow name nothing answers to and no FlowTest, When reading, Then it throws FlowNotFoundError', async () => {
    // Arrange
    listTestNames.mockResolvedValue([])
    retrieve.mockResolvedValue([])

    // Act & Assert
    await expect(sut.readFlow('Missing_Flow')).rejects.toEqual(
      new FlowNotFoundError('Missing_Flow')
    )
  })

  it('Given names in another case, When reading, Then the source carries the names as the org spells them', async () => {
    // Arrange
    retrieve.mockResolvedValue([flowFile, testFile('Sets_Rating')])

    // Act
    const result = await sut.readFlow('account_after', [
      'FLOWTESTING.ACCOUNT_AFTER.sets_rating',
    ])

    // Assert
    expect(retrieve).toHaveBeenCalledWith([
      { type: 'Flow', fullNames: ['account_after'] },
      { type: 'FlowTest', fullNames: ['sets_rating'] },
    ])
    expect(result).toEqual({
      apiName: 'Account_After',
      xml: recordTriggeredFlowXml(),
      tests: [{ fullName: 'Sets_Rating', xml: flowTestXml('Account_After') }],
    })
  })

  it('Given the same FlowTest named twice, When reading, Then it is retrieved and run once', async () => {
    // Arrange
    retrieve.mockResolvedValue([flowFile, testFile('Sets_Rating')])

    // Act
    const result = await sut
      .readFlow('Account_After', [
        'Sets_Rating',
        'Account_After.SETS_RATING',
        'Other',
        'other',
      ])
      .catch((error: unknown) => error)

    // Assert
    expect(retrieve.mock.calls[0][0][1]).toEqual({
      type: 'FlowTest',
      fullNames: ['Sets_Rating', 'Other'],
    })
    expect(result).toEqual(
      new FlowTestNotFoundError('Account_After', ['Other'])
    )
  })

  it('Given a FlowTest whose flow is spelled in another case, When reading, Then it belongs to the flow', async () => {
    // Arrange
    retrieve.mockResolvedValue([flowFile, testFile('A', 'ACCOUNT_AFTER')])

    // Act
    const result = await sut.readFlow('Account_After', ['A'])

    // Assert
    expect(result.tests.map(test => test.fullName)).toEqual(['A'])
  })

  it('Given a FlowTest without a flow name, When reading, Then it belongs to no flow', async () => {
    // Arrange
    retrieve.mockResolvedValue([
      flowFile,
      {
        type: 'FlowTest',
        fullName: 'A',
        xml: '<FlowTest xmlns="http://soap.sforce.com/2006/04/metadata"/>',
      },
    ])

    // Act & Assert
    await expect(sut.readFlow('Account_After', ['A'])).rejects.toEqual(
      new FlowTestNotFoundError('Account_After', ['A'])
    )
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

  it.each([
    ['flowtesting.account_after.T', 'T'],
    ['ACCOUNT_AFTER.T', 'T'],
    ['FlowTestingX.T', 'FlowTestingX.T'],
    ['Account_AfterT', 'Account_AfterT'],
  ])('Given %s, When normalised, Then it reads %s', (name, expected) => {
    // Act & Assert
    expect(toFlowTestName(name, 'Account_After')).toBe(expected)
  })
})
