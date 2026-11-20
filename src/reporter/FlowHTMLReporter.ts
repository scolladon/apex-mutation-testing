import type { Messages } from '@salesforce/core'
import type { FlowMutant, FlowMutationResult } from '../flow/types.js'
import {
  assertReportDirWithinCwd,
  type MutationTestResult,
  REPORT_SCHEMA_VERSION,
  REPORT_THRESHOLDS,
  type ReportMutant,
  writeMutationReport,
} from './mutationReportPage.js'

// Maps a Flow run onto the shared report page. Locations are exact: each
// mutant carries the source position of what it changes, so nothing here
// searches the XML for a snippet. Every evaluated mutant ran against every
// selected FlowTest, which the report lists as the Flow's test file so it
// can show which of them killed the mutant.
export class FlowHTMLReporter {
  constructor(private readonly messages: Messages<string>) {}

  // The run writes to the org for minutes: a report directory outside the
  // working directory, which the report would be refused, is refused before
  // it starts.
  async assertReportDirAllowed(outputDir: string): Promise<void> {
    await assertReportDirWithinCwd(outputDir, this.messages)
  }

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
          mutants: result.mutants.map(mutant =>
            mapMutant(mutant, result.testNames)
          ),
        },
      },
      testFiles: {
        [`FlowTesting.${result.flowApiName}`]: {
          tests: result.testNames.map(name => ({ id: name, name })),
        },
      },
    }
  }
}

const RAN_AGAINST_TESTS = new Set(['Killed', 'Survived'])

const mapMutant = (mutant: FlowMutant, testNames: string[]): ReportMutant => ({
  id: mutant.id,
  mutatorName: mutant.mutatorName,
  replacement: mutant.replacement,
  description: mutant.description,
  status: mutant.status,
  statusReason: mutant.statusReason,
  static: false,
  coveredBy: RAN_AGAINST_TESTS.has(mutant.status) ? testNames : undefined,
  killedBy: mutant.killedBy?.length ? mutant.killedBy : undefined,
  // Only a mutant whose FlowTests ran to a verdict completed any.
  testsCompleted: RAN_AGAINST_TESTS.has(mutant.status) ? 1 : 0,
  location: mutant.location,
})
