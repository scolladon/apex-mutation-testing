import { Connection } from '@salesforce/core'
import { mapLimit } from 'async'
import { chunk } from './queryChunking.js'

export interface EntityDefinitionRow {
  DeveloperName: string
  QualifiedApiName: string
  NamespacePrefix: string | null
}

// SOQL caps statement length, so a large perimeter must be queried in
// batches.
const DEVELOPER_NAME_QUERY_CHUNK_SIZE = 200

// Bounds the fan-out of concurrent EntityDefinition queries: chunk count is
// caller-controlled (one chunk per 200 developer names), so an unbounded
// Promise.all would let the perimeter size dictate concurrent Tooling API
// load.
const MAX_CONCURRENT_DEVELOPER_NAME_QUERIES = 25

export class EntityDefinitionRepository {
  constructor(private readonly connection: Connection) {}

  public async readByDeveloperNames(
    names: string[]
  ): Promise<EntityDefinitionRow[]> {
    const chunks = chunk(names, DEVELOPER_NAME_QUERY_CHUNK_SIZE)
    const rows = await mapLimit(
      chunks,
      MAX_CONCURRENT_DEVELOPER_NAME_QUERIES,
      async (chunkNames: string[]) => this.queryByDeveloperNames(chunkNames)
    )
    return rows.flat()
  }

  // Guards the sink rather than trusting `chunk`'s emptiness semantics: an
  // empty `$in` makes jsforce drop the whole WHERE clause, and
  // EntityDefinition refuses queryMore(), so an unfiltered read would throw
  // rather than page through the org. Filtering on NamespacePrefix
  // server-side is not an option either: EntityDefinition silently drops
  // that predicate, so the namespace join happens in memory by the caller.
  private async queryByDeveloperNames(
    names: string[]
  ): Promise<EntityDefinitionRow[]> {
    if (names.length === 0) {
      return []
    }
    return (await this.connection.tooling
      .sobject('EntityDefinition')
      .find({ DeveloperName: { $in: names } }, [
        'DeveloperName',
        'QualifiedApiName',
        'NamespacePrefix',
      ])
      .execute()) as unknown as EntityDefinitionRow[]
  }
}
