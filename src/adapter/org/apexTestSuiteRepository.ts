import { Connection } from '@salesforce/core'
import type { ApexTestSuiteMember } from '../../port/apexSourceProvider.js'

interface TestSuiteMembershipRecord {
  ApexTestSuite: { TestSuiteName: string }
  ApexClass: { Name: string }
}

interface ApexTestSuiteRecord {
  TestSuiteName: string
}

const escapeSoqlLiteral = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const toSoqlLiteralList = (values: string[]): string =>
  values.map(value => `'${escapeSoqlLiteral(value)}'`).join(', ')

export class ApexTestSuiteRepository {
  constructor(private readonly connection: Connection) {}

  public async readMembers(
    suiteNames: string[]
  ): Promise<ApexTestSuiteMember[]> {
    const records = await this.query<TestSuiteMembershipRecord>(
      `SELECT ApexTestSuite.TestSuiteName, ApexClass.Name FROM TestSuiteMembership WHERE ApexTestSuite.TestSuiteName IN (${toSoqlLiteralList(suiteNames)}) ORDER BY ApexClass.Name`
    )
    return records.map(record => ({
      suiteName: record.ApexTestSuite.TestSuiteName,
      className: record.ApexClass.Name,
    }))
  }

  public async readExistingSuiteNames(suiteNames: string[]): Promise<string[]> {
    const records = await this.query<ApexTestSuiteRecord>(
      `SELECT TestSuiteName FROM ApexTestSuite WHERE TestSuiteName IN (${toSoqlLiteralList(suiteNames)})`
    )
    return records.map(record => record.TestSuiteName)
  }

  private async query<T>(soql: string): Promise<T[]> {
    const result = await this.connection.autoFetchQuery(soql, { tooling: true })
    // autoFetchQuery's generic is jsforce's Schema slot, not a row shape;
    // the row shape is pinned by the SOQL projection above and by the test.
    return result.records as unknown as T[]
  }
}
