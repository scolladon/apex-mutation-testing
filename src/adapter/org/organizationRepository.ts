import { Connection } from '@salesforce/core'

interface OrganizationRow {
  NamespacePrefix: string | null
}

interface OrganizationKindRow {
  IsSandbox: boolean
  OrganizationType: string | null
}

// What the org says it is: whether it is a sandbox (scratch orgs are), and
// its edition ('Developer Edition' for Developer Edition orgs and Trailhead
// playgrounds alike, which report IsSandbox = false).
export interface OrganizationKind {
  isSandbox: boolean
  organizationType: string | null
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

  // Fails closed: only an explicit `true` from the org counts as a sandbox,
  // and a missing edition is null, never a guess.
  public async readOrganizationKind(): Promise<OrganizationKind> {
    const result = await this.connection.query<OrganizationKindRow>(
      'SELECT IsSandbox, OrganizationType FROM Organization'
    )
    const row = result.records[0]
    return {
      isSandbox: row?.IsSandbox === true,
      organizationType:
        typeof row?.OrganizationType === 'string' ? row.OrganizationType : null,
    }
  }
}
