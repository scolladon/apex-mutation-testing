import { Connection } from '@salesforce/core'
import JSZip from 'jszip'
import { escapeXmlText } from '../../flow/xml/FlowXmlDom.js'
import {
  FlowDeployFailedError,
  FlowDeployNotCompletedError,
} from '../../port/flowErrors.js'

type RetrieveRequest = Parameters<Connection['metadata']['retrieve']>[0]
type DeployResult = Awaited<
  ReturnType<Connection['metadata']['checkDeployStatus']>
>

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export type FlowMetadataType = 'Flow' | 'FlowTest'

export interface FlowMetadataFile {
  type: FlowMetadataType
  fullName: string
  xml: string
}

const FOLDERS: Record<FlowMetadataType, { folder: string; suffix: string }> = {
  Flow: { folder: 'flows', suffix: 'flow' },
  FlowTest: { folder: 'flowtests', suffix: 'flowtest' },
}

const ZIP_ENTRY =
  /^(?:unpackaged\/)?(flows|flowtests)\/(.+)\.(?:flow|flowtest)$/

const DEFAULT_POLL_INITIAL_INTERVAL_MS = 500
const DEFAULT_POLL_MAX_INTERVAL_MS = 5000
const DEFAULT_POLL_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
const POLL_BACKOFF_FACTOR = 1.5
const MAX_CONSECUTIVE_READ_FAILURES = 3

interface PollOptions {
  initialIntervalMs?: number
  maxIntervalMs?: number
  timeoutMs?: number
}

export class MetadataPollTimeoutError extends Error {
  constructor(
    public readonly operation: 'deploy' | 'retrieve',
    public readonly asyncProcessId: string
  ) {
    super(
      `Metadata API ${operation} ${asyncProcessId} did not complete within the poll timeout`
    )
    this.name = 'MetadataPollTimeoutError'
  }
}

interface ComponentFailure {
  problem?: string
}

const asArray = <T>(value: T | T[] | undefined): T[] =>
  // Stryker disable next-line ArrayDeclaration: the only caller reads each
  // entry's `problem` and drops the entries without one, so a stray entry in
  // the empty case is dropped the same way.
  value === undefined ? [] : Array.isArray(value) ? value : [value]

// Flows and FlowTests travel through the Metadata API as zip packages built
// and read in memory: nothing of the user's project directory is read or
// written, so an interrupted run never leaves a mutant in the working tree.
export class FlowMetadataRepository {
  constructor(
    private readonly connection: Connection,
    private readonly pollOptions: PollOptions = {}
  ) {}

  public async retrieve(
    members: { type: FlowMetadataType; fullNames: string[] }[]
  ): Promise<FlowMetadataFile[]> {
    const version = this.connection.getApiVersion()
    // The vendor Package type declares every field of a full package.xml as
    // required; a retrieve request only ever needs types and version.
    const unpackaged = {
      types: members
        .filter(member => member.fullNames.length > 0)
        .map(member => ({ name: member.type, members: member.fullNames })),
      version,
    } as unknown as RetrieveRequest['unpackaged']
    const { id } = await this.connection.metadata.retrieve({
      apiVersion: Number(version),
      singlePackage: true,
      unpackaged,
    })
    const result = await this.poll('retrieve', id, () =>
      this.connection.metadata.checkRetrieveStatus(id)
    )
    if (!result.success) {
      throw new Error(
        `Metadata API retrieve ${id} failed: ${result.errorMessage ?? result.status}`
      )
    }
    return this.unzip(result.zipFile)
  }

  // Resolves once the org saved every component. Throws
  // FlowDeployFailedError when it refused at least one — the one failure a
  // caller may treat as data about the XML — and FlowDeployNotCompletedError
  // for everything else (a timeout, a cancellation, an org-wide failure, a
  // status that could not be read): then what the deploy did is unknown.
  public async deploy(files: FlowMetadataFile[], cancel = true): Promise<void> {
    const zip = await this.zip(files)
    let id: string
    try {
      ;({ id } = await this.connection.metadata.deploy(zip, {
        singlePackage: true,
        rollbackOnError: true,
        testLevel: 'NoTestRun',
      }))
    } catch (error: unknown) {
      // The request may or may not have queued a deploy, and there is no id
      // to follow it by.
      throw new FlowDeployNotCompletedError(
        undefined,
        'Unknown',
        false,
        errorText(error)
      )
    }
    const result = await this.awaitDeploy(id, cancel)
    if (result.success) return
    const problems = asArray(
      result.details?.componentFailures as
        | ComponentFailure
        | ComponentFailure[]
        | undefined
    )
      .map(failure => failure.problem)
      .filter((problem): problem is string => Boolean(problem))
    if (problems.length > 0) {
      throw new FlowDeployFailedError(problems)
    }
    throw new FlowDeployNotCompletedError(
      id,
      String(result.status),
      false,
      result.errorMessage ?? String(result.status)
    )
  }

  // Follows deploy `id` to a terminal state. When it does not get there
  // within the poll timeout, or its status cannot be read, the deploy is
  // cancelled and followed again: a deploy left running could still land
  // after the caller moved on. One that still does not finish is reported
  // pending, with its id, for the caller to wait on.
  public async awaitDeploy(id: string, cancel = true): Promise<DeployResult> {
    const check = () => this.connection.metadata.checkDeployStatus(id, true)
    try {
      return await this.poll('deploy', id, check)
    } catch (firstError: unknown) {
      try {
        if (!cancel) throw firstError
        await this.connection.metadata.cancelDeploy(id)
        return await this.poll('deploy', id, check)
      } catch (error: unknown) {
        throw new FlowDeployNotCompletedError(
          id,
          'InProgress',
          true,
          `${errorText(firstError)}; then ${errorText(error)}`
        )
      }
    }
  }

  private async zip(files: FlowMetadataFile[]): Promise<Buffer> {
    const archive = new JSZip()
    archive.file('package.xml', this.packageXml(files))
    for (const file of files) {
      const { folder, suffix } = FOLDERS[file.type]
      archive.file(`${folder}/${file.fullName}.${suffix}`, file.xml)
    }
    return archive.generateAsync({ type: 'nodebuffer' })
  }

  private packageXml(files: FlowMetadataFile[]): string {
    const types = (Object.keys(FOLDERS) as FlowMetadataType[])
      .map(type => ({
        type,
        names: files.filter(file => file.type === type).map(f => f.fullName),
      }))
      .filter(({ names }) => names.length > 0)
      .map(
        ({ type, names }) =>
          `    <types>\n${names.map(name => `        <members>${escapeXmlText(name)}</members>\n`).join('')}        <name>${type}</name>\n    </types>\n`
      )
      .join('')
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n${types}    <version>${this.connection.getApiVersion()}</version>\n</Package>\n`
  }

  private async unzip(zipFile: string): Promise<FlowMetadataFile[]> {
    const archive = await JSZip.loadAsync(zipFile, { base64: true })
    const files: FlowMetadataFile[] = []
    for (const entry of Object.values(archive.files)) {
      const match = ZIP_ENTRY.exec(entry.name)
      if (!match) continue
      files.push({
        type: match[1] === 'flows' ? 'Flow' : 'FlowTest',
        fullName: match[2],
        xml: await entry.async('string'),
      })
    }
    return files
  }

  private async poll<T extends { done: boolean }>(
    operation: 'deploy' | 'retrieve',
    id: string,
    check: () => Promise<T>
  ): Promise<T> {
    const deadline =
      Date.now() + (this.pollOptions.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS)
    const maxIntervalMs =
      this.pollOptions.maxIntervalMs ?? DEFAULT_POLL_MAX_INTERVAL_MS
    let intervalMs =
      this.pollOptions.initialIntervalMs ?? DEFAULT_POLL_INITIAL_INTERVAL_MS
    // A status read can fail once on its own (a dropped connection): only
    // several failures in a row stop the polling.
    let failures = 0
    const read = async (): Promise<T | undefined> => {
      try {
        const status = await check()
        failures = 0
        return status
      } catch (error: unknown) {
        failures++
        if (failures >= MAX_CONSECUTIVE_READ_FAILURES) throw error
        return undefined
      }
    }
    let result = await read()
    while (!result?.done) {
      if (Date.now() > deadline) {
        throw new MetadataPollTimeoutError(operation, id)
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs))
      intervalMs = Math.min(intervalMs * POLL_BACKOFF_FACTOR, maxIntervalMs)
      result = await read()
    }
    return result
  }
}
