import { Connection } from '@salesforce/core'
import JSZip from 'jszip'
import { escapeXmlText } from '../../flow/xml/FlowXmlDom.js'
import { FlowDeployFailedError } from '../../port/flowErrors.js'

type RetrieveRequest = Parameters<Connection['metadata']['retrieve']>[0]

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

  // Throws FlowDeployFailedError when the org refuses a component — the one
  // failure a caller may treat as data — and anything else unchanged.
  public async deploy(files: FlowMetadataFile[]): Promise<void> {
    const { id } = await this.connection.metadata.deploy(
      await this.zip(files),
      {
        singlePackage: true,
        rollbackOnError: true,
        testLevel: 'NoTestRun',
      }
    )
    const result = await this.poll('deploy', id, () =>
      this.connection.metadata.checkDeployStatus(id, true)
    )
    if (!result.success) {
      const failures = asArray(
        result.details?.componentFailures as
          | ComponentFailure
          | ComponentFailure[]
          | undefined
      )
      const problems = failures
        .map(failure => failure.problem)
        .filter((problem): problem is string => Boolean(problem))
      throw new FlowDeployFailedError(
        problems.length > 0
          ? problems
          : [result.errorMessage ?? String(result.status)]
      )
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
    let result = await check()
    while (!result.done) {
      if (Date.now() > deadline) {
        throw new MetadataPollTimeoutError(operation, id)
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs))
      intervalMs = Math.min(intervalMs * POLL_BACKOFF_FACTOR, maxIntervalMs)
      result = await check()
    }
    return result
  }
}
