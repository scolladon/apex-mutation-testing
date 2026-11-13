import { Connection } from '@salesforce/core'
import {
  FlowAmbiguousError,
  FlowDeployFailedError,
  FlowNotFoundError,
} from '../../port/flowErrors.js'
import { toSoqlLiteralList } from './soqlLiteral.js'

const reasonsOf = (errors: (string | { message: string })[]): string[] =>
  errors.map(error => (typeof error === 'string' ? error : error.message))

export interface FlowVersionRow {
  id: string
  versionNumber: number
  status: string
}

interface FlowDefinitionRecord {
  Id: string
}

interface FlowRecord {
  Id: string
  VersionNumber: number
  Status: string
}

// Reads, activates and deletes the versions of one flow through the Tooling
// API. A version is identified by its number, which is stable for the
// version's life; its record Id is not (the platform may re-key a version
// when it is saved), so callers re-read Ids right before they use them.
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
      `SELECT Id, VersionNumber, Status FROM Flow WHERE DefinitionId = ${toSoqlLiteralList([definitionId])} ORDER BY VersionNumber`
    )
    return result.records.map(record => ({
      id: record.Id,
      versionNumber: Number(record.VersionNumber),
      status: record.Status,
    }))
  }

  // Makes `versionNumber` the flow's Active version; the one Active before it
  // becomes Obsolete. A refusal from the org is a FlowDeployFailedError, as
  // for a refused deploy: per mutant it is a verdict, not a run failure.
  public async activateVersion(
    definitionId: string,
    versionNumber: number
  ): Promise<void> {
    const result = await this.connection.tooling
      .sobject('FlowDefinition')
      .update({
        Id: definitionId,
        Metadata: { activeVersionNumber: versionNumber },
      })
    if (!result.success) {
      throw new FlowDeployFailedError(reasonsOf(result.errors))
    }
  }

  public async deleteVersion(version: FlowVersionRow): Promise<void> {
    const result = await this.connection.tooling
      .sobject('Flow')
      .delete(version.id)
    if (!result.success) {
      throw new Error(
        `Could not delete version ${version.versionNumber}: ${reasonsOf(result.errors).join('; ')}`
      )
    }
  }
}
