import { Connection } from '@salesforce/core'
import { mapLimit } from 'async'
import { ApexClass } from '../type/ApexClass.js'
import { ApexClassIdentity } from '../type/ApexClassIdentity.js'
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

// Whether a container deploy asks the org to run tests. Named rather than a
// bare boolean so the call sites read as intent instead of a flag.
export const RUN_TESTS = 'run-tests'
export const SKIP_TESTS = 'skip-tests'
export type DeployTestPolicy = typeof RUN_TESTS | typeof SKIP_TESTS

// SOQL caps statement length, so a large perimeter must be queried in
// batches.
const IDENTITY_QUERY_CHUNK_SIZE = 200

// Bounds the fan-out of concurrent identity queries: chunk count is
// user-controlled (one chunk per 200 perimeter classes), so an unbounded
// Promise.all would let the perimeter size dictate concurrent Tooling API
// load. Matches the bounded idiom in sObjectDescribeRepository.ts.
const MAX_CONCURRENT_IDENTITY_QUERIES = 25

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

interface PollOptions {
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

// Distinguishes a plugin-authored deploy failure from an org-thrown error
// structurally, so callers never have to match on this message's text (which
// is never localised, but is not a reliable discriminator either).
export class DeploymentFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeploymentFailedError'
  }
}

export class ApexClassRepository {
  constructor(
    protected readonly connection: Connection,
    private readonly pollOptions: PollOptions = {}
  ) {
    // Validate poll configuration eagerly so misconfiguration fails fast
    // at construction rather than mid-deploy with non-deterministic behaviour.
    // The `!== undefined` halves below are required by the type system, not by
    // the logic: `undefined < 0` and `undefined === 0` are both false, so
    // dropping them would not change behaviour for an unset option.
    const { initialIntervalMs, maxIntervalMs, timeoutMs } = pollOptions
    // Stryker disable next-line ConditionalExpression: type narrowing only.
    if (initialIntervalMs !== undefined && initialIntervalMs < 0) {
      throw new Error(
        `pollOptions.initialIntervalMs must be >= 0 (got ${initialIntervalMs})`
      )
    }
    // Stryker disable next-line ConditionalExpression: type narrowing only.
    if (maxIntervalMs !== undefined && maxIntervalMs < 0) {
      throw new Error(
        `pollOptions.maxIntervalMs must be >= 0 (got ${maxIntervalMs})`
      )
    }
    // timeoutMs <= 0 allowed only for test harnesses that want an instant
    // timeout; reject 0 which is the racy value (deadline == now).
    // Stryker disable next-line ConditionalExpression: type narrowing only.
    if (timeoutMs !== undefined && timeoutMs === 0) {
      throw new Error(
        `pollOptions.timeoutMs must be non-zero (0 is racy); use a negative value for immediate timeout or a positive value for a real budget`
      )
    }
  }

  public async read(name: string, fields?: string[]) {
    const finder = this.connection.tooling.sobject('ApexClass')
    const query = fields
      ? finder.find({ Name: name, NamespacePrefix: '' }, fields)
      : finder.find({ Name: name, NamespacePrefix: '' })
    return (await query.execute())[0]
  }

  // No namespace pin here, unlike `read`: pinning `NamespacePrefix: ''`
  // makes a namespaced class indistinguishable from one that does not exist
  // at all, and telling those two apart is the whole point of this query.
  public async readIdentities(names: string[]): Promise<ApexClassIdentity[]> {
    const chunks = chunk(names, IDENTITY_QUERY_CHUNK_SIZE)
    const rows = await mapLimit(
      chunks,
      MAX_CONCURRENT_IDENTITY_QUERIES,
      async (chunkNames: string[]) => this.queryIdentities(chunkNames)
    )
    return rows.flat()
  }

  // Guards the sink rather than trusting `chunk`'s emptiness semantics: an
  // empty `$in` makes jsforce drop the whole WHERE clause, turning this into
  // an unfiltered org-wide read that would classify every perimeter entry as
  // accessible.
  private async queryIdentities(names: string[]): Promise<ApexClassIdentity[]> {
    if (names.length === 0) {
      return []
    }
    return (await this.connection.tooling
      .sobject('ApexClass')
      .find({ Name: { $in: names } }, ['Name', 'NamespacePrefix'])
      .execute()) as unknown as ApexClassIdentity[]
  }

  public async getApexClassDependencies(
    classId: string
  ): Promise<MetadataComponentDependency[]> {
    return (await this.connection.tooling
      .sobject('MetadataComponentDependency')
      .find({ MetadataComponentId: classId })
      .execute()) as MetadataComponentDependency[]
  }

  // Deploys ask the org to run the class's tests, which is what leaves the
  // org's stored coverage matching the body just deployed. Callers that are
  // abandoning a run pass SKIP_TESTS: the org is then often out of test quota,
  // which makes a test-running deploy the request most likely to be refused,
  // and a restore that is refused is one that leaves a mutant behind.
  public async update(
    apexClass: ApexClass,
    testPolicy: DeployTestPolicy = RUN_TESTS
  ) {
    return this.deployToContainer(apexClass, testPolicy)
  }

  // The container → member → request → poll → cleanup cycle a single class
  // deploy runs to verify compilation and pick up its coverage.
  private async deployToContainer(
    apexClass: ApexClass,
    testPolicy: DeployTestPolicy
  ) {
    const containerId = await this.createContainer()
    try {
      await this.addMembers(containerId, apexClass)
      const requestId = await this.createDeployRequest(containerId, testPolicy)
      return await this.awaitSuccessfulDeploy(requestId)
    } finally {
      // Fire-and-forget cleanup: awaiting this would add a full Tooling API
      // round-trip to every deploy (500 extra calls on a 500-mutant run).
      // If the delete fails, Salesforce reaps the MetadataContainer after 24h.
      this.deleteContainer(containerId)
    }
  }

  private async createContainer(): Promise<string> {
    const container = await this.connection.tooling
      .sobject('MetadataContainer')
      .create({
        Name: `MutationTest_${Date.now()}`,
      })

    if (!container.id) {
      throw new Error('MetadataContainer did not return an ID')
    }
    return container.id
  }

  private async addMembers(
    containerId: string,
    apexClass: ApexClass
  ): Promise<void> {
    await this.connection.tooling.sobject('ApexClassMember').create({
      MetadataContainerId: containerId,
      ContentEntityId: apexClass.Id,
      Body: apexClass.Body,
    })
  }

  private async createDeployRequest(
    containerId: string,
    testPolicy: DeployTestPolicy
  ): Promise<string> {
    const asyncRequest = await this.connection.tooling
      .sobject('ContainerAsyncRequest')
      .create({
        IsCheckOnly: false,
        MetadataContainerId: containerId,
        IsRunTests: testPolicy === RUN_TESTS,
      })

    if (!asyncRequest.id) {
      throw new Error('ContainerAsyncRequest did not return an ID')
    }
    return asyncRequest.id
  }

  private async awaitSuccessfulDeploy(requestId: string) {
    const result = await this.pollForCompletion(requestId)

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

      throw new DeploymentFailedError(`Deployment failed:\n${formattedErrors}`)
    }

    return result
  }

  private deleteContainer(containerId: string): void {
    this.connection.tooling
      .sobject('MetadataContainer')
      .delete(containerId)
      .catch(() => {
        // Non-fatal: swallow so the unhandled rejection does not surface
        // and the container gets reaped by Salesforce after 24h.
      })
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
