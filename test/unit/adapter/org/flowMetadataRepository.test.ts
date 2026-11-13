import type { Connection } from '@salesforce/core'
import JSZip from 'jszip'
import {
  FlowMetadataRepository,
  MetadataPollTimeoutError,
} from '../../../../src/adapter/org/flowMetadataRepository.js'
import { FlowDeployFailedError } from '../../../../src/port/flowErrors.js'

const zipOf = async (files: Record<string, string>): Promise<string> => {
  const archive = new JSZip()
  for (const [name, content] of Object.entries(files))
    archive.file(name, content)
  return archive.generateAsync({ type: 'base64' })
}

const unzip = async (buffer: Buffer): Promise<Record<string, string>> => {
  const archive = await JSZip.loadAsync(buffer)
  const files: Record<string, string> = {}
  for (const entry of Object.values(archive.files)) {
    files[entry.name] = await entry.async('string')
  }
  return files
}

describe('FlowMetadataRepository', () => {
  const metadata = {
    retrieve: vi.fn(),
    checkRetrieveStatus: vi.fn(),
    deploy: vi.fn(),
    checkDeployStatus: vi.fn(),
  }
  const connection = {
    metadata,
    getApiVersion: () => '66.0',
  } as unknown as Connection
  const fastPoll = { initialIntervalMs: 0, maxIntervalMs: 0 }

  describe('retrieve', () => {
    it('Given Flow and FlowTest members, When retrieved, Then one singlePackage request names them and the zip is read in memory', async () => {
      // Arrange
      metadata.retrieve.mockResolvedValue({ id: '09S1' })
      metadata.checkRetrieveStatus
        .mockResolvedValueOnce({ done: false })
        .mockResolvedValueOnce({
          done: true,
          success: true,
          zipFile: await zipOf({
            'flows/Account_After.flow': '<Flow/>',
            'unpackaged/flowtests/Sets_Rating.flowtest': '<FlowTest/>',
            'package.xml': '<Package/>',
            'other/flows/Nested.flow': '<Flow/>',
            'flows/Backup.flow.bak': '<Flow/>',
          }),
        })
      const sut = new FlowMetadataRepository(connection, fastPoll)

      // Act
      const files = await sut.retrieve([
        { type: 'Flow', fullNames: ['Account_After'] },
        { type: 'FlowTest', fullNames: ['Sets_Rating'] },
        { type: 'FlowTest', fullNames: [] },
      ])

      // Assert
      expect(metadata.retrieve).toHaveBeenCalledWith({
        apiVersion: 66,
        singlePackage: true,
        unpackaged: {
          types: [
            { name: 'Flow', members: ['Account_After'] },
            { name: 'FlowTest', members: ['Sets_Rating'] },
          ],
          version: '66.0',
        },
      })
      expect(files).toEqual([
        { type: 'Flow', fullName: 'Account_After', xml: '<Flow/>' },
        { type: 'FlowTest', fullName: 'Sets_Rating', xml: '<FlowTest/>' },
      ])
    })

    it.each([
      [
        { errorMessage: 'INVALID_SESSION', status: 'Failed' },
        'INVALID_SESSION',
      ],
      [{ status: 'Failed' }, 'Failed'],
    ])(
      'Given a failed retrieve %j, When retrieved, Then it throws with the reason',
      async (result, reason) => {
        // Arrange
        metadata.retrieve.mockResolvedValue({ id: '09S2' })
        metadata.checkRetrieveStatus.mockResolvedValue({
          done: true,
          success: false,
          ...result,
        })
        const sut = new FlowMetadataRepository(connection, fastPoll)

        // Act & Assert
        await expect(
          sut.retrieve([{ type: 'Flow', fullNames: ['F'] }])
        ).rejects.toThrow(`Metadata API retrieve 09S2 failed: ${reason}`)
      }
    )

    it('Given a retrieve that never completes, When retrieved, Then it times out', async () => {
      // Arrange
      metadata.retrieve.mockResolvedValue({ id: '09S3' })
      metadata.checkRetrieveStatus.mockResolvedValue({ done: false })
      const sut = new FlowMetadataRepository(connection, {
        ...fastPoll,
        timeoutMs: -1,
      })

      // Act & Assert
      await expect(
        sut.retrieve([{ type: 'Flow', fullNames: ['F'] }])
      ).rejects.toEqual(new MetadataPollTimeoutError('retrieve', '09S3'))
    })

    it('Given default poll options, When the first check is done, Then no wait happens', async () => {
      // Arrange
      metadata.retrieve.mockResolvedValue({ id: '09S4' })
      metadata.checkRetrieveStatus.mockResolvedValue({
        done: true,
        success: true,
        zipFile: await zipOf({}),
      })

      // Act & Assert
      await expect(
        new FlowMetadataRepository(connection).retrieve([
          { type: 'Flow', fullNames: ['F'] },
        ])
      ).resolves.toEqual([])
    })
  })

  describe('deploy', () => {
    it('Given files, When deployed, Then a zip with a package.xml is deployed without tests and polled with details', async () => {
      // Arrange
      metadata.deploy.mockResolvedValue({ id: '0Af1' })
      metadata.checkDeployStatus.mockResolvedValue({
        done: true,
        success: true,
      })
      const sut = new FlowMetadataRepository(connection, fastPoll)

      // Act
      await sut.deploy([
        { type: 'Flow', fullName: 'Account_After', xml: '<Flow/>' },
        { type: 'FlowTest', fullName: 'A&B', xml: '<FlowTest/>' },
      ])

      // Assert
      const [buffer, options] = metadata.deploy.mock.calls[0]
      expect(options).toEqual({
        singlePackage: true,
        rollbackOnError: true,
        testLevel: 'NoTestRun',
      })
      const files = await unzip(buffer)
      expect(files['flows/Account_After.flow']).toBe('<Flow/>')
      expect(files['flowtests/A&B.flowtest']).toBe('<FlowTest/>')
      expect(files['package.xml']).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Account_After</members>
        <name>Flow</name>
    </types>
    <types>
        <members>A&amp;B</members>
        <name>FlowTest</name>
    </types>
    <version>66.0</version>
</Package>
`)
      expect(metadata.checkDeployStatus).toHaveBeenCalledWith('0Af1', true)
    })

    it.each([
      [
        { details: { componentFailures: { problem: 'Element x invalid' } } },
        ['Element x invalid'],
      ],
      [
        {
          details: {
            componentFailures: [{ problem: 'a' }, {}, { problem: 'b' }],
          },
        },
        ['a', 'b'],
      ],
      [{ errorMessage: 'Deploy canceled', details: {} }, ['Deploy canceled']],
      [{ status: 'Failed' }, ['Failed']],
    ])(
      'Given a refused deploy %j, When deployed, Then it throws FlowDeployFailedError with the problems',
      async (result, problems) => {
        // Arrange
        metadata.deploy.mockResolvedValue({ id: '0Af2' })
        metadata.checkDeployStatus.mockResolvedValue({
          done: true,
          success: false,
          ...result,
        })
        const sut = new FlowMetadataRepository(connection, fastPoll)

        // Act & Assert
        await expect(
          sut.deploy([{ type: 'Flow', fullName: 'F', xml: '<Flow/>' }])
        ).rejects.toEqual(new FlowDeployFailedError(problems))
      }
    )

    it('Given two files of one type, When deployed, Then the package names both under that type only', async () => {
      // Arrange
      metadata.deploy.mockResolvedValue({ id: '0Af4' })
      metadata.checkDeployStatus.mockResolvedValue({
        done: true,
        success: true,
      })
      const sut = new FlowMetadataRepository(connection, fastPoll)

      // Act
      await sut.deploy([
        { type: 'FlowTest', fullName: 'A', xml: '<FlowTest/>' },
        { type: 'FlowTest', fullName: 'B', xml: '<FlowTest/>' },
      ])

      // Assert
      const files = await unzip(metadata.deploy.mock.calls.at(-1)![0])
      expect(files['package.xml']).toContain(
        '    <types>\n        <members>A</members>\n        <members>B</members>\n        <name>FlowTest</name>\n    </types>\n    <version>'
      )
      expect(files['package.xml']).not.toContain('<name>Flow</name>')
    })

    it('Given a deploy that never completes, When deployed, Then it times out naming the deploy', async () => {
      // Arrange
      metadata.deploy.mockResolvedValue({ id: '0Af3' })
      metadata.checkDeployStatus
        .mockResolvedValueOnce({ done: false })
        .mockResolvedValue({ done: false })
      const sut = new FlowMetadataRepository(connection, {
        initialIntervalMs: 1,
        maxIntervalMs: 1,
        timeoutMs: 5,
      })

      // Act & Assert
      await expect(
        sut.deploy([{ type: 'Flow', fullName: 'F', xml: '<Flow/>' }])
      ).rejects.toEqual(new MetadataPollTimeoutError('deploy', '0Af3'))
    })
  })
})
