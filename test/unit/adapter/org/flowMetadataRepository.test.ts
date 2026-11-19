import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Connection } from '@salesforce/core'
import JSZip from 'jszip'
import {
  FlowMetadataRepository,
  MetadataPollTimeoutError,
} from '../../../../src/adapter/org/flowMetadataRepository.js'
import {
  FlowDeployFailedError,
  FlowDeployNotCompletedError,
} from '../../../../src/port/flowErrors.js'

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
    cancelDeploy: vi.fn(),
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

    const flow = [{ type: 'Flow' as const, fullName: 'F', xml: '<Flow/>' }]

    it.each([
      [
        { status: 'Canceled', errorMessage: 'Deploy canceled', details: {} },
        new FlowDeployNotCompletedError(
          '0Af2',
          'Canceled',
          false,
          'Deploy canceled'
        ),
      ],
      [
        { status: 'Failed', details: { componentFailures: [{}] } },
        new FlowDeployNotCompletedError('0Af2', 'Failed', false, 'Failed'),
      ],
      [
        { errorMessage: 'UNKNOWN_EXCEPTION' },
        new FlowDeployNotCompletedError(
          '0Af2',
          'undefined',
          false,
          'UNKNOWN_EXCEPTION'
        ),
      ],
    ])(
      'Given a failed deploy %j with no component refused, When deployed, Then its outcome is reported unknown, not a refusal',
      async (result, expected) => {
        // Arrange
        metadata.deploy.mockResolvedValue({ id: '0Af2' })
        metadata.checkDeployStatus.mockResolvedValue({
          done: true,
          success: false,
          ...result,
        })
        const sut = new FlowMetadataRepository(connection, fastPoll)

        // Act & Assert
        await expect(sut.deploy(flow)).rejects.toEqual(expected)
      }
    )

    it.each([
      [new Error('socket hang up'), 'socket hang up'],
      ['down', 'down'],
    ])(
      'Given a deploy request that fails (%s), When deployed, Then the outcome is unknown with no deploy to follow',
      async (failure, detail) => {
        // Arrange
        metadata.deploy.mockRejectedValue(failure)
        const sut = new FlowMetadataRepository(connection, fastPoll)

        // Act & Assert
        await expect(sut.deploy(flow)).rejects.toEqual(
          new FlowDeployNotCompletedError(undefined, 'Unknown', false, detail)
        )
        expect(metadata.checkDeployStatus).not.toHaveBeenCalled()
      }
    )

    it('Given a deploy that times out and then finishes once cancelled, When deployed, Then its final result is used', async () => {
      // Arrange
      metadata.deploy.mockResolvedValue({ id: '0Af3' })
      metadata.checkDeployStatus
        .mockResolvedValueOnce({ done: false })
        .mockResolvedValueOnce({ done: true, success: true })
      metadata.cancelDeploy.mockResolvedValue({ done: false })
      const sut = new FlowMetadataRepository(connection, {
        ...fastPoll,
        timeoutMs: -1,
      })

      // Act
      await sut.deploy(flow)

      // Assert
      expect(metadata.cancelDeploy).toHaveBeenCalledWith('0Af3')
      expect(metadata.checkDeployStatus).toHaveBeenCalledTimes(2)
    })

    it('Given a status read that fails once, When deployed, Then the polling goes on without cancelling, and a deploy cancelled by somebody else is reported unknown', async () => {
      // Arrange
      metadata.deploy.mockResolvedValue({ id: '0Af5' })
      metadata.checkDeployStatus
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({
          done: true,
          success: false,
          status: 'Canceled',
        })
      const sut = new FlowMetadataRepository(connection, fastPoll)

      // Act & Assert
      await expect(sut.deploy(flow)).rejects.toEqual(
        new FlowDeployNotCompletedError('0Af5', 'Canceled', false, 'Canceled')
      )
      expect(metadata.cancelDeploy).not.toHaveBeenCalled()
    })

    it('Given two failed status reads then a success, When deployed, Then it resolves', async () => {
      // Arrange
      metadata.deploy.mockResolvedValue({ id: '0Af8' })
      metadata.checkDeployStatus
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce({ done: true, success: true })
      const sut = new FlowMetadataRepository(connection, fastPoll)

      // Act & Assert
      await expect(sut.deploy(flow)).resolves.toBeUndefined()
      expect(metadata.cancelDeploy).not.toHaveBeenCalled()
    })

    it('Given three failed status reads in a row, When deployed, Then the deploy is cancelled and followed again', async () => {
      // Arrange
      metadata.deploy.mockResolvedValue({ id: '0Af9' })
      metadata.checkDeployStatus
        .mockRejectedValueOnce(new Error('one'))
        .mockRejectedValueOnce(new Error('two'))
        .mockRejectedValueOnce(new Error('three'))
        .mockResolvedValueOnce({ done: true, success: true })
      metadata.cancelDeploy.mockResolvedValue({})
      const sut = new FlowMetadataRepository(connection, fastPoll)

      // Act
      await sut.deploy(flow)

      // Assert
      expect(metadata.cancelDeploy).toHaveBeenCalledWith('0Af9')
      expect(metadata.checkDeployStatus).toHaveBeenCalledTimes(4)
    })

    it('Given a restore deploy that times out, When deployed without cancelling, Then it is reported pending and never cancelled', async () => {
      // Arrange
      metadata.deploy.mockResolvedValue({ id: '0AfA' })
      metadata.checkDeployStatus.mockResolvedValue({ done: false })
      const sut = new FlowMetadataRepository(connection, {
        ...fastPoll,
        timeoutMs: -1,
      })
      const timeout = new MetadataPollTimeoutError('deploy', '0AfA').message

      // Act & Assert
      await expect(sut.deploy(flow, false)).rejects.toEqual(
        new FlowDeployNotCompletedError(
          '0AfA',
          'InProgress',
          true,
          `${timeout}; then ${timeout}`
        )
      )
      expect(metadata.cancelDeploy).not.toHaveBeenCalled()
    })

    it('Given a deploy that never completes, even cancelled, When deployed, Then it is reported pending with both causes', async () => {
      // Arrange
      metadata.deploy.mockResolvedValue({ id: '0Af3' })
      metadata.checkDeployStatus.mockResolvedValue({ done: false })
      metadata.cancelDeploy.mockResolvedValue({})
      const sut = new FlowMetadataRepository(connection, {
        ...fastPoll,
        timeoutMs: -1,
      })
      const timeout = new MetadataPollTimeoutError('deploy', '0Af3').message

      // Act & Assert
      await expect(sut.deploy(flow)).rejects.toEqual(
        new FlowDeployNotCompletedError(
          '0Af3',
          'InProgress',
          true,
          `${timeout}; then ${timeout}`
        )
      )
    })

    it.each([
      [new Error('cancel refused'), 'cancel refused'],
      ['refused', 'refused'],
    ])(
      'Given a deploy that times out and cannot be cancelled (%s), When deployed, Then it is reported pending',
      async (failure, detail) => {
        // Arrange
        metadata.deploy.mockResolvedValue({ id: '0Af6' })
        metadata.checkDeployStatus.mockResolvedValue({ done: false })
        metadata.cancelDeploy.mockRejectedValue(failure)
        const sut = new FlowMetadataRepository(connection, {
          ...fastPoll,
          timeoutMs: -1,
        })
        const timeout = new MetadataPollTimeoutError('deploy', '0Af6').message

        // Act & Assert
        await expect(sut.deploy(flow)).rejects.toEqual(
          new FlowDeployNotCompletedError(
            '0Af6',
            'InProgress',
            true,
            `${timeout}; then ${detail}`
          )
        )
      }
    )

    it('Given a pending deploy still running after the timeout, When awaited, Then it is cancelled by default and its final result returned', async () => {
      // Arrange — a mutant deploy the restore waits for is better cancelled
      const result = { done: true, success: false, status: 'Canceled' }
      metadata.checkDeployStatus
        .mockResolvedValueOnce({ done: false })
        .mockResolvedValueOnce(result)
      metadata.cancelDeploy.mockResolvedValue({})
      const sut = new FlowMetadataRepository(connection, {
        ...fastPoll,
        timeoutMs: -1,
      })

      // Act & Assert
      await expect(sut.awaitDeploy('0AfB')).resolves.toBe(result)
      expect(metadata.cancelDeploy).toHaveBeenCalledWith('0AfB')
    })

    it('Given a pending deploy, When awaited, Then its terminal result is returned', async () => {
      // Arrange
      const result = { done: true, success: false, status: 'Succeeded' }
      metadata.checkDeployStatus.mockResolvedValue(result)
      const sut = new FlowMetadataRepository(connection, fastPoll)

      // Act & Assert
      await expect(sut.awaitDeploy('0Af7')).resolves.toBe(result)
      expect(metadata.checkDeployStatus).toHaveBeenCalledWith('0Af7', true)
    })
  })

  describe('polling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('Given a timeout, When it is reached, Then the error names the operation and its id', () => {
      // Act
      const sut = new MetadataPollTimeoutError('retrieve', '09S9')

      // Assert
      expect(sut.name).toBe('MetadataPollTimeoutError')
      expect(sut.message).toBe(
        'Metadata API retrieve 09S9 did not complete within the poll timeout'
      )
      expect(sut).toMatchObject({
        operation: 'retrieve',
        asyncProcessId: '09S9',
      })
    })

    it('Given default poll options, When a retrieve keeps running, Then it waits 500 ms, then 1.5 times longer each time', async () => {
      // Arrange
      metadata.retrieve.mockResolvedValue({ id: '09S5' })
      metadata.checkRetrieveStatus.mockResolvedValue({ done: false })
      const sut = new FlowMetadataRepository(connection)

      // Act
      const pending = sut
        .retrieve([{ type: 'Flow', fullNames: ['F'] }])
        .catch(() => undefined)
      const callsAt = async (ms: number) => {
        await vi.advanceTimersByTimeAsync(ms)
        return metadata.checkRetrieveStatus.mock.calls.length
      }

      // Assert — 500, 750, 1125 ms…, capped at 5000
      expect(await callsAt(0)).toBe(1)
      expect(await callsAt(499)).toBe(1)
      expect(await callsAt(1)).toBe(2)
      expect(await callsAt(749)).toBe(2)
      expect(await callsAt(1)).toBe(3)
      expect(await callsAt(1125)).toBe(4)
      // 1687.5, 2531.25, 3796.875 ms (each timer truncated), then the 5000 ms cap
      expect(await callsAt(1688 + 2532 + 3797)).toBe(7)
      expect(await callsAt(4996)).toBe(7)
      expect(await callsAt(1)).toBe(8)
      expect(await callsAt(5000)).toBe(9)
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
      await pending
    })

    it('Given default poll options, When a retrieve keeps running, Then it times out only after 10 minutes', async () => {
      // Arrange
      metadata.retrieve.mockResolvedValue({ id: '09S6' })
      metadata.checkRetrieveStatus.mockResolvedValue({ done: false })
      const sut = new FlowMetadataRepository(connection)
      let outcome: unknown = 'running'

      // Act
      const pending = sut
        .retrieve([{ type: 'Flow', fullNames: ['F'] }])
        .catch((error: unknown) => {
          outcome = error
        })
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000 - 5000)

      // Assert
      expect(outcome).toBe('running')
      await vi.advanceTimersByTimeAsync(10_000)
      await pending
      expect(outcome).toEqual(new MetadataPollTimeoutError('retrieve', '09S6'))
    })

    it('Given a check made exactly at the deadline, When the operation is still running, Then the poll goes on', async () => {
      // Arrange
      metadata.retrieve.mockResolvedValue({ id: '09S7' })
      metadata.checkRetrieveStatus
        .mockResolvedValueOnce({ done: false })
        .mockResolvedValueOnce({ done: false })
        .mockResolvedValueOnce({ done: true, success: false, status: 'Failed' })
      const sut = new FlowMetadataRepository(connection, {
        initialIntervalMs: 10,
        maxIntervalMs: 10,
        timeoutMs: 10,
      })

      // Act
      const pending = sut
        .retrieve([{ type: 'Flow', fullNames: ['F'] }])
        .catch((error: Error) => error.message)
      await vi.advanceTimersByTimeAsync(20)

      // Assert — the third check answered, not the deadline
      await expect(pending).resolves.toBe(
        'Metadata API retrieve 09S7 failed: Failed'
      )
    })
  })

  describe('against a real connection and a local SOAP server', () => {
    // The Metadata API answers in SOAP: one componentFailures element comes
    // back as an object, several as an array, and a cancelled deploy with no
    // component failure at all — the shapes the in-memory tests assume.
    let server: Server
    let real: FlowMetadataRepository
    let statusResult = ''

    const envelope = (operation: string, result: string) =>
      `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata"><soapenv:Body><${operation}Response><result>${result}</result></${operation}Response></soapenv:Body></soapenv:Envelope>`

    beforeAll(async () => {
      server = createServer((request, response) => {
        let body = ''
        request.on('data', chunk => {
          body += chunk
        })
        request.on('end', () => {
          response.writeHead(200, { 'content-type': 'text/xml' })
          response.end(
            body.includes('checkDeployStatus')
              ? envelope('checkDeployStatus', statusResult)
              : envelope(
                  'deploy',
                  '<id>0Af9</id><done>false</done><state>Queued</state>'
                )
          )
        })
      })
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      const { port } = server.address() as AddressInfo
      const realConnection = new Connection({
        authInfo: { getUsername: () => 'user' },
        connectionOptions: {
          instanceUrl: `http://127.0.0.1:${port}`,
          accessToken: 'token',
          version: '66.0',
        },
      } as unknown as ConstructorParameters<typeof Connection>[0])
      await realConnection.init()
      real = new FlowMetadataRepository(realConnection, {
        initialIntervalMs: 0,
        maxIntervalMs: 0,
      })
    })

    afterAll(() => {
      server.close()
    })

    const failure = (problem: string) =>
      `<componentFailures><componentType>Flow</componentType><fullName>F</fullName><problem>${problem}</problem><problemType>Error</problemType><success>false</success></componentFailures>`

    const flow = [{ type: 'Flow' as const, fullName: 'F', xml: '<Flow/>' }]

    it.each([
      [
        'one component failure',
        failure('Element x invalid'),
        ['Element x invalid'],
      ],
      ['two component failures', failure('a') + failure('b'), ['a', 'b']],
    ])(
      'Given a deploy refused with %s, When deployed, Then it is a deploy failure naming each problem',
      async (_label, failures, problems) => {
        // Arrange
        statusResult = `<id>0Af9</id><done>true</done><success>false</success><status>Failed</status><details>${failures}</details>`

        // Act & Assert
        await expect(real.deploy(flow)).rejects.toEqual(
          new FlowDeployFailedError(problems)
        )
      }
    )

    it('Given a deploy cancelled in the org, When deployed, Then its outcome is reported unknown', async () => {
      // Arrange
      statusResult =
        '<id>0Af9</id><done>true</done><success>false</success><status>Canceled</status><details></details>'

      // Act & Assert
      await expect(real.deploy(flow)).rejects.toEqual(
        new FlowDeployNotCompletedError('0Af9', 'Canceled', false, 'Canceled')
      )
    })

    it('Given a successful deploy, When deployed, Then it resolves', async () => {
      // Arrange
      statusResult =
        '<id>0Af9</id><done>true</done><success>true</success><status>Succeeded</status>'

      // Act & Assert
      await expect(real.deploy(flow)).resolves.toBeUndefined()
    })
  })
})
