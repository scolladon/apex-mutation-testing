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
    // `||`, not `??`: the org can report the "no namespace" case as either
    // `null` or `''`, and both must normalise the same way — isOwnNamespace's
    // folding treats them alike, so the earliest read must too.
    return result.records[0]?.NamespacePrefix || null
  }
}
