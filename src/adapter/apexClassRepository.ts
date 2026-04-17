import { Connection } from '@salesforce/core'
import { ApexClass } from '../type/ApexClass.js'
import { MetadataComponentDependency } from '../type/MetadataComponentDependency.js'

const DEFAULT_POLL_INITIAL_INTERVAL_MS = 100
const DEFAULT_POLL_MAX_INTERVAL_MS = 2000
const DEFAULT_POLL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const POLL_BACKOFF_FACTOR = 1.5
const TERMINAL_STATES = new Set([
  'Completed',
  'Failed',
  'Error',
  'Aborted',
]) as ReadonlySet<string>

export interface PollOptions {
  initialIntervalMs?: number
  maxIntervalMs?: number
  timeoutMs?: number
}

export class PollTimeoutError extends Error {
  constructor(
    public readonly requestId: string,
    public readonly lastState: string
  ) {
    super(
      `Tooling API ContainerAsyncRequest ${requestId} did not reach a terminal state within the poll timeout (last state: ${lastState})`
    )
    this.name = 'PollTimeoutError'
  }
}

export class ApexClassRepository {
  constructor(
    protected readonly connection: Connection,
    private readonly pollOptions: PollOptions = {}
  ) {}

  public async read(name: string) {
    return (
      await this.connection.tooling
        .sobject('ApexClass')
        .find({ Name: name, NamespacePrefix: '' })
        .execute()
    )[0]
  }

  public async getApexClassDependencies(
    classId: string
  ): Promise<MetadataComponentDependency[]> {
    return (await this.connection.tooling
      .sobject('MetadataComponentDependency')
      .find({ MetadataComponentId: classId })
      .execute()) as MetadataComponentDependency[]
  }

  public async update(apexClass: ApexClass) {
    const container = await this.connection.tooling
      .sobject('MetadataContainer')
      .create({
        Name: `MutationTest_${Date.now()}`,
      })

    if (!container.id) {
      throw new Error('MetadataContainer did not return an ID')
    }
    const containerId = container.id
    try {
      await this.connection.tooling.sobject('ApexClassMember').create({
        MetadataContainerId: containerId,
        ContentEntityId: apexClass.Id,
        Body: apexClass.Body,
      })

      const asyncRequest = await this.connection.tooling
        .sobject('ContainerAsyncRequest')
        .create({
          IsCheckOnly: false,
          MetadataContainerId: containerId,
          IsRunTests: true,
        })

      if (!asyncRequest.id) {
        throw new Error('ContainerAsyncRequest did not return an ID')
      }

      const result = await this.pollForCompletion(asyncRequest.id)

      if (result['State'] === 'Failed') {
        const messages = result['DeployDetails']?.['allComponentMessages']
        const formattedErrors = Array.isArray(messages)
          ? messages
              .map(
                m =>
                  `[${m.fileName}:${m.lineNumber}:${m.columnNumber}] ${m.problem}`
              )
              .join('\n')
          : result['ErrorMsg'] || 'Unknown error'

        throw new Error(`Deployment failed:\n${formattedErrors}`)
      }

      return result
    } finally {
      await this.deleteContainer(containerId)
    }
  }

  private async deleteContainer(containerId: string): Promise<void> {
    try {
      await this.connection.tooling
        .sobject('MetadataContainer')
        .delete(containerId)
    } catch {
      // Non-fatal: the container will be reaped by Salesforce after 24h if
      // delete fails here. Swallowing keeps the original error (if any) in flight.
    }
  }

  private async pollForCompletion(requestId: string) {
    const initialIntervalMs =
      this.pollOptions.initialIntervalMs ?? DEFAULT_POLL_INITIAL_INTERVAL_MS
    const maxIntervalMs =
      this.pollOptions.maxIntervalMs ?? DEFAULT_POLL_MAX_INTERVAL_MS
    const timeoutMs = this.pollOptions.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS
    const deadline = Date.now() + timeoutMs

    let intervalMs = initialIntervalMs
    let result = await this.connection.tooling
      .sobject('ContainerAsyncRequest')
      .retrieve(requestId)

    while (!TERMINAL_STATES.has(result['State'] as string)) {
      if (Date.now() > deadline) {
        throw new PollTimeoutError(requestId, String(result['State']))
      }
      await this.delay(intervalMs)
      intervalMs = Math.min(
        Math.floor(intervalMs * POLL_BACKOFF_FACTOR),
        maxIntervalMs
      )
      result = await this.connection.tooling
        .sobject('ContainerAsyncRequest')
        .retrieve(requestId)
    }

    return result
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
