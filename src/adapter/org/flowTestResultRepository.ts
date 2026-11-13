import { Connection } from '@salesforce/core'
import { toSoqlLiteralList } from './soqlLiteral.js'

// One stored FlowTest result. A run records a row per FlowTest it executed,
// either new or rewritten in place over an earlier run's row for the same
// FlowTest and version — so a row that is new, or whose modstamp moved,
// since an earlier read was produced by the runs in between.
export interface FlowTestResultRow {
  id: string
  versionNumber: number
  modstamp: string
}

interface FlowTestResultRecord {
  Id: string
  FlowVersionNumber: number
  SystemModstamp: string
}

// The record Id form a FlowDefinitionViewId takes: the definition's 15
// character Id. The 18 character form is passed too, so a platform that ever
// stores that one is matched rather than read as "no result".
const SHORT_ID_LENGTH = 15

// The test runner reports which tests ran and how each ended, never which
// flow version it ran them against. FlowTestResult does: reading it before
// and after a run tells the version every test of that run executed.
export class FlowTestResultRepository {
  constructor(private readonly connection: Connection) {}

  public async listResults(definitionId: string): Promise<FlowTestResultRow[]> {
    const viewIds = [definitionId.slice(0, SHORT_ID_LENGTH), definitionId]
    const result = await this.connection.autoFetchQuery(
      `SELECT Id, FlowVersionNumber, SystemModstamp FROM FlowTestResult WHERE FlowDefinitionViewId IN (${toSoqlLiteralList(viewIds)})`
    )
    // autoFetchQuery's generic is jsforce's Schema slot, not a row shape;
    // the row shape is pinned by the SOQL projection above and by the test.
    return (result.records as unknown as FlowTestResultRecord[]).map(
      record => ({
        id: record.Id,
        versionNumber: Number(record.FlowVersionNumber),
        modstamp: record.SystemModstamp,
      })
    )
  }
}

// The versions the runs between two reads executed: every row that is new
// in `after`, or whose modstamp moved.
export const versionsRunBetween = (
  before: FlowTestResultRow[],
  after: FlowTestResultRow[]
): number[] => {
  const seen = new Set(before.map(row => `${row.id}|${row.modstamp}`))
  return after
    .filter(row => !seen.has(`${row.id}|${row.modstamp}`))
    .map(row => row.versionNumber)
}
