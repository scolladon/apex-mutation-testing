import { Connection } from '@salesforce/core'

interface OrganizationRow {
  NamespacePrefix: string | null
}

export class OrganizationRepository {
  constructor(private readonly connection: Connection) {}

  // Organization is a singleton object: exactly one row always exists. A
  // plain (non-Tooling) query is enough — namespacedness is org metadata,
  // not a Tooling API concern.
  public async readNamespacePrefix(): Promise<string | null> {
    const result = await this.connection.query<OrganizationRow>(
      'SELECT NamespacePrefix FROM Organization'
    )
    return result.records[0]?.NamespacePrefix ?? null
  }
}
