import { Connection } from '@salesforce/core'

export class ApexSettingsRepository {
  constructor(private readonly connection: Connection) {}

  public async isAggregateCoverageOnly(): Promise<boolean> {
    const result = await this.connection.tooling.query<{
      IsAggregateCodeCoverageOnlyEnabled: boolean
    }>('SELECT IsAggregateCodeCoverageOnlyEnabled FROM ApexSettings')
    return result.records[0]?.IsAggregateCodeCoverageOnlyEnabled ?? false
  }
}
