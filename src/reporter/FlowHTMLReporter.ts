import type { Messages } from '@salesforce/core'
import type { FlowMutant, FlowMutationResult } from '../flow/types.js'
import {
  type MutationTestResult,
  REPORT_SCHEMA_VERSION,
  REPORT_THRESHOLDS,
  type ReportMutant,
  writeMutationReport,
} from './mutationReportPage.js'

// Maps a Flow run onto the shared report page. Locations are exact: each
// mutant carries the source position of the edit it makes, so nothing here
// searches the XML for a snippet.
export class FlowHTMLReporter {
  constructor(private readonly messages: Messages<string>) {}

  async generateReport(
    result: FlowMutationResult,
    outputDir: string
  ): Promise<void> {
    await writeMutationReport(this.transform(result), outputDir, this.messages)
  }

  private transform(result: FlowMutationResult): MutationTestResult {
    return {
      schemaVersion: REPORT_SCHEMA_VERSION,
      config: {},
      thresholds: REPORT_THRESHOLDS,
      files: {
        [`${result.flowApiName}.flow-meta.xml`]: {
          language: 'xml',
          source: result.sourceXml,
          mutants: result.mutants.map(mapMutant),
        },
      },
    }
  }
}

const mapMutant = (mutant: FlowMutant): ReportMutant => ({
  id: mutant.id,
  mutatorName: mutant.mutatorName,
  replacement: mutant.replacement,
  status: mutant.status,
  statusReason: mutant.statusReason ?? mutant.description,
  static: false,
  killedBy: mutant.killedBy?.length ? mutant.killedBy : undefined,
  testsCompleted: mutant.status === 'Pending' ? 0 : 1,
  location: mutant.location,
})
