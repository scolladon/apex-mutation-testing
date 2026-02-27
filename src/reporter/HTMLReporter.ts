import { writeFile } from 'node:fs/promises'
import * as path from 'path'
import { ApexMutationTestResult } from '../type/ApexMutationTestResult.js'

export class ApexMutationHTMLReporter {
  async generateReport(
    apexMutationTestResult: ApexMutationTestResult,
    outputDir: string = 'reports'
  ): Promise<void> {
    const reportData = this.transformApexResults(apexMutationTestResult)
    // Generate and write the HTML file with the report data embedded
    const htmlContent = createReportHtml(reportData)
    await writeFile(path.join(outputDir, 'index.html'), htmlContent)
  }

  private transformApexResults(apexMutationTestResult: ApexMutationTestResult) {
    const mutationTestResult = {
      schemaVersion: '2.0.0',
      config: {}, // You can add your configuration here
      thresholds: {
        high: 80,
        low: 60,
      },
      files: {},
    }

    const untestedStatuses = new Set([
      'CompileError',
      'RuntimeError',
      'Pending',
    ])

    const fileResult = {
      language: 'java',
      source: apexMutationTestResult.sourceFileContent,
      mutants: apexMutationTestResult.mutants.map(mutant => ({
        id: mutant.id,
        mutatorName: mutant.mutatorName,
        replacement: mutant.replacement,
        status: mutant.status,
        statusReason: mutant.statusReason,
        static: false,
        coveredBy: untestedStatuses.has(mutant.status) ? undefined : ['0'],
        killedBy: mutant.status === 'Killed' ? ['0'] : undefined,
        testsCompleted: untestedStatuses.has(mutant.status) ? 0 : 1,
        location: {
          start: {
            line: mutant.location.start.line,
            column: mutant.location.start.column,
          },
          end: {
            line: mutant.location.end.line,
            column: mutant.location.end.column,
          },
        },
      })),
    }

    mutationTestResult.files[`${apexMutationTestResult.sourceFile}.cls`] =
      fileResult

    return mutationTestResult
  }
}

const createReportHtml = report => {
  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Mutation Testing Report</title>
    <script src="https://cdn.jsdelivr.net/npm/mutation-testing-elements@3.5.1/dist/mutation-test-elements.min.js"></script>
  </head>
  <body>
    <mutation-test-report-app titlePostfix="apex-mutation-testing">
      Your browser doesn't support <a href="https://caniuse.com/#search=custom%20elements">custom elements</a>.
      Please use a latest version of an evergreen browser (Firefox, Chrome, Safari, Opera, Edge, etc).
    </mutation-test-report-app>
    <script>
      const app = document.querySelector('mutation-test-report-app');
      app.report = ${escapeHtmlTags(JSON.stringify(report))};
    </script>
  </body>
  </html>`
}

/**
 * Escapes the HTML tags inside strings in a JSON input by breaking them apart.
 */
function escapeHtmlTags(json: string) {
  const j = json.replace(/</g, '<"+"')
  return j
}
