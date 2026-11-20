import { Connection } from '@salesforce/core'
import {
  FlowAmbiguousError,
  FlowDeployFailedError,
  FlowNotFoundError,
} from '../../port/flowErrors.js'
import { toSoqlLiteralList } from './soqlLiteral.js'

// jsforce's single-record update() and delete() never resolve with
// success: false: the org's answer to a request it refuses is a rejection.
// A refused save comes back as a REST error whose body lists the offending
// `fields` (an empty list included), as the sandbox showed for an invalid
// version number (INVALID_INPUT) or an Active version (DELETE_FAILED); a
// session, limit or server error has no such list, and a transport failure
// carries no error body at all.
const isOrgRefusal = (error: unknown): error is Error =>
  error instanceof Error &&
  Array.isArray((error as { data?: { fields?: unknown } }).data?.fields)

export interface FlowVersionRow {
  id: string
  versionNumber: number
  status: string
  // Empty when the version has none.
  description: string
}

interface FlowDefinitionRecord {
  Id: string
}

interface FlowRecord {
  Id: string
  VersionNumber: number
  Status: string
  Description: string | null
}

// Reads, activates and deletes the versions of one flow through the Tooling
// API. A version's number is stable for its life, but a deleted version's
// number is given again to the next version created. Its record Id survives
// an activation but not a save: a Draft saved in place gets a new Id, so
// callers re-read Ids right before they use them.
export class FlowVersionRepository {
  constructor(private readonly connection: Connection) {}

  public async readDefinitionId(apiName: string): Promise<string> {
    const result = await this.connection.tooling.query<FlowDefinitionRecord>(
      `SELECT Id FROM FlowDefinition WHERE DeveloperName = ${toSoqlLiteralList([apiName])}`
    )
    if (result.records.length === 0) {
      throw new FlowNotFoundError(apiName)
    }
    if (result.records.length > 1) {
      throw new FlowAmbiguousError(apiName, result.records.length)
    }
    return result.records[0].Id
  }

  // Ordered by version number, oldest first.
  public async listVersions(definitionId: string): Promise<FlowVersionRow[]> {
    const result = await this.connection.tooling.query<FlowRecord>(
      `SELECT Id, VersionNumber, Status, Description FROM Flow WHERE DefinitionId = ${toSoqlLiteralList([definitionId])} ORDER BY VersionNumber`
    )
    return result.records.map(record => ({
      id: record.Id,
      versionNumber: Number(record.VersionNumber),
      status: record.Status,
      description: record.Description ?? '',
    }))
  }

  // Makes `versionNumber` the flow's Active version; the one Active before it
  // becomes Obsolete. A refusal from the org is a FlowDeployFailedError, as
  // for a refused deploy: per mutant it is a verdict, not a run failure. Any
  // other failure (session, transport) propagates unchanged.
  public async activateVersion(
    definitionId: string,
    versionNumber: number
  ): Promise<void> {
    try {
      await this.connection.tooling.sobject('FlowDefinition').update({
        Id: definitionId,
        Metadata: { activeVersionNumber: versionNumber },
      })
    } catch (error: unknown) {
      throw isOrgRefusal(error)
        ? new FlowDeployFailedError([error.message])
        : error
    }
  }

  public async deleteVersion(version: FlowVersionRow): Promise<void> {
    try {
      await this.connection.tooling.sobject('Flow').delete(version.id)
    } catch (error: unknown) {
      throw isOrgRefusal(error)
        ? new Error(
            `Could not delete version ${version.versionNumber}: ${error.message}`,
            { cause: error }
          )
        : error
    }
  }
}
