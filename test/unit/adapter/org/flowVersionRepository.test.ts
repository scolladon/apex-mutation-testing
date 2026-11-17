import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Connection } from '@salesforce/core'
import { FlowVersionRepository } from '../../../../src/adapter/org/flowVersionRepository.js'
import {
  FlowAmbiguousError,
  FlowDeployFailedError,
  FlowNotFoundError,
} from '../../../../src/port/flowErrors.js'

const DRAFT_ROW = {
  id: '3012',
  versionNumber: 2,
  status: 'Draft',
  description: '',
}

// jsforce's HttpApiError: named after the errorCode of the error body, which
// travels on `data`.
const apiError = (errorCode: string, data: unknown): Error =>
  Object.assign(new Error(`${errorCode}: failure`), {
    name: errorCode,
    errorCode,
    data,
  })

const refusal = (errorCode: string, message: string): Error =>
  Object.assign(apiError(errorCode, { message, errorCode, fields: [] }), {
    message,
  })

describe('FlowVersionRepository', () => {
  const query = vi.fn()
  const remove = vi.fn()
  const update = vi.fn()
  const sobject = vi.fn().mockReturnValue({ delete: remove, update })
  const connection = {
    tooling: { query, sobject },
  } as unknown as Connection
  const sut = new FlowVersionRepository(connection)

  describe('readDefinitionId', () => {
    it('Given one definition, When read, Then its Id is returned from an escaped Tooling query', async () => {
      // Arrange
      query.mockResolvedValue({ records: [{ Id: '300A' }] })

      // Act
      const result = await sut.readDefinitionId("Bad'Name")

      // Assert
      expect(result).toBe('300A')
      expect(query).toHaveBeenCalledWith(
        "SELECT Id FROM FlowDefinition WHERE DeveloperName = 'Bad\\'Name'"
      )
    })

    it('Given no definition, When read, Then it throws FlowNotFoundError', async () => {
      // Arrange
      query.mockResolvedValue({ records: [] })

      // Act & Assert
      await expect(sut.readDefinitionId('X')).rejects.toEqual(
        new FlowNotFoundError('X')
      )
    })

    it('Given several definitions, When read, Then it throws FlowAmbiguousError', async () => {
      // Arrange
      query.mockResolvedValue({ records: [{ Id: '1' }, { Id: '2' }] })

      // Act & Assert
      await expect(sut.readDefinitionId('X')).rejects.toEqual(
        new FlowAmbiguousError('X', 2)
      )
    })
  })

  describe('listVersions', () => {
    it('Given versions, When listed, Then they are mapped in version order', async () => {
      // Arrange
      query.mockResolvedValue({
        records: [
          {
            Id: '3011',
            VersionNumber: 1,
            Status: 'Obsolete',
            Description: 'Rates accounts',
          },
          {
            Id: '3012',
            VersionNumber: '2',
            Status: 'Active',
            Description: null,
          },
        ],
      })

      // Act
      const result = await sut.listVersions('300A')

      // Assert
      expect(result).toEqual([
        {
          id: '3011',
          versionNumber: 1,
          status: 'Obsolete',
          description: 'Rates accounts',
        },
        { id: '3012', versionNumber: 2, status: 'Active', description: '' },
      ])
      expect(query).toHaveBeenCalledWith(
        "SELECT Id, VersionNumber, Status, Description FROM Flow WHERE DefinitionId = '300A' ORDER BY VersionNumber"
      )
    })
  })

  describe('activateVersion', () => {
    it('Given an accepted activation, When activating, Then the FlowDefinition metadata names the version', async () => {
      // Arrange
      update.mockResolvedValue({ success: true, errors: [] })

      // Act
      await sut.activateVersion('300A', 6)

      // Assert
      expect(sobject).toHaveBeenCalledWith('FlowDefinition')
      expect(update).toHaveBeenCalledWith({
        Id: '300A',
        Metadata: { activeVersionNumber: 6 },
      })
    })

    it('Given an activation the org refuses, When activating, Then it throws a deploy failure with the reason', async () => {
      // Arrange — jsforce rejects; the body lists the offending fields
      update.mockRejectedValue(
        refusal('INVALID_INPUT', 'Invalid version number: 99')
      )

      // Act & Assert
      await expect(sut.activateVersion('300A', 99)).rejects.toEqual(
        new FlowDeployFailedError(['Invalid version number: 99'])
      )
    })

    it.each([
      ['a transport failure', new TypeError('fetch failed')],
      ['a session error', apiError('INVALID_SESSION_ID', { message: 'x' })],
      ['an error body without fields', apiError('SERVER_UNAVAILABLE', null)],
      ['a value that is not an Error', 'down'],
      [
        'an error-shaped value that is not an Error',
        { message: 'x', errorCode: 'INVALID_INPUT', data: { fields: [] } },
      ],
    ])(
      'Given %s, When activating, Then it propagates unchanged',
      async (_label, failure) => {
        // Arrange
        update.mockRejectedValue(failure)

        // Act & Assert
        await expect(sut.activateVersion('300A', 6)).rejects.toBe(failure)
      }
    )
  })

  describe('deleteVersion', () => {
    it('Given a successful delete, When deleting, Then the Tooling Flow record is deleted by Id', async () => {
      // Arrange
      remove.mockResolvedValue({ success: true, errors: [] })

      // Act
      await sut.deleteVersion(DRAFT_ROW)

      // Assert
      expect(sobject).toHaveBeenCalledWith('Flow')
      expect(remove).toHaveBeenCalledWith('3012')
    })

    it('Given a delete the org refuses, When deleting, Then it throws naming the version, with the refusal as cause', async () => {
      // Arrange
      const failure = refusal('DELETE_FAILED', 'it is active')
      remove.mockRejectedValue(failure)

      // Act
      const error = await sut.deleteVersion(DRAFT_ROW).catch((e: Error) => e)

      // Assert
      expect(error).toEqual(
        new Error('Could not delete version 2: it is active')
      )
      expect((error as Error).cause).toBe(failure)
    })

    it('Given a transport failure, When deleting, Then it propagates unchanged', async () => {
      // Arrange
      const failure = new TypeError('fetch failed')
      remove.mockRejectedValue(failure)

      // Act & Assert
      await expect(sut.deleteVersion(DRAFT_ROW)).rejects.toBe(failure)
    })
  })

  describe('against a real connection and a local HTTP server', () => {
    // The answers jsforce turns into rejections: what the sandbox returned
    // for a refused activation and delete, a session error, and a dropped
    // socket.
    type Answer = (socket: { destroy(): void }) => [number, unknown] | undefined
    const answers: Record<string, Answer> = {}
    let server: Server
    let real: FlowVersionRepository

    beforeAll(async () => {
      server = createServer((request, response) => {
        const answer = answers[`${request.method} ${request.url}`]
        const reply = answer?.(request.socket)
        if (!reply) return
        response.writeHead(reply[0], { 'content-type': 'application/json' })
        response.end(JSON.stringify(reply[1]))
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
      real = new FlowVersionRepository(realConnection)
    })

    afterAll(() => {
      server.close()
    })

    const ACTIVATE =
      'PATCH /services/data/v66.0/tooling/sobjects/FlowDefinition/300A'
    const DELETE = 'DELETE /services/data/v66.0/tooling/sobjects/Flow/3012'

    it('Given an org refusing the activation, When activating, Then it is a deploy failure carrying the reason', async () => {
      // Arrange
      answers[ACTIVATE] = () => [
        400,
        [
          {
            message: 'Invalid version number: 99',
            errorCode: 'INVALID_INPUT',
            fields: [],
          },
        ],
      ]

      // Act & Assert
      await expect(real.activateVersion('300A', 99)).rejects.toEqual(
        new FlowDeployFailedError(['Invalid version number: 99'])
      )
    })

    it('Given an expired session, When activating, Then the session error propagates, not a deploy failure', async () => {
      // Arrange
      answers[ACTIVATE] = () => [
        401,
        [
          {
            message: 'Session expired or invalid',
            errorCode: 'INVALID_SESSION_ID',
          },
        ],
      ]

      // Act
      const error = await real.activateVersion('300A', 2).catch(e => e)

      // Assert
      expect(error).not.toBeInstanceOf(FlowDeployFailedError)
      expect(error).toMatchObject({ errorCode: 'INVALID_SESSION_ID' })
    })

    it('Given a dropped connection, When activating, Then the transport error propagates, not a deploy failure', async () => {
      // Arrange
      answers[ACTIVATE] = socket => {
        socket.destroy()
        return undefined
      }

      // Act
      const error = await real.activateVersion('300A', 2).catch(e => e)

      // Assert
      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(FlowDeployFailedError)
    })

    it('Given an org refusing to delete an Active version, When deleting, Then it throws naming the version', async () => {
      // Arrange
      answers[DELETE] = () => [
        400,
        [
          {
            message:
              'You cannot delete this flow version because it is active.',
            errorCode: 'DELETE_FAILED',
            fields: [],
          },
        ],
      ]

      // Act & Assert
      await expect(real.deleteVersion(DRAFT_ROW)).rejects.toThrow(
        'Could not delete version 2: You cannot delete this flow version because it is active.'
      )
    })
  })
})
