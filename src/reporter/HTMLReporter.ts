import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import * as path from 'path'
import { ApexMutationTestResult } from '../type/ApexMutationTestResult.js'

const requireFromHere = createRequire(import.meta.url)
const MUTATION_TEST_ELEMENTS_PATH = requireFromHere.resolve(
  'mutation-testing-elements/dist/mutation-test-elements.js'
)

async function loadMutationTestElements(): Promise<string> {
  const content = await readFile(MUTATION_TEST_ELEMENTS_PATH, 'utf8')
  return content
}

export class ApexMutationHTMLReporter {
  async generateReport(
    apexMutationTestResult: ApexMutationTestResult,
    outputDir: string = 'reports'
  ): Promise<void> {
    const resolvedDir = resolveSafeOutputDir(outputDir)
    await mkdir(resolvedDir, { recursive: true })
    const reportData = this.transformApexResults(apexMutationTestResult)
    const bundle = await loadMutationTestElements()
    const htmlContent = createReportHtml(reportData, bundle)
    await writeFile(path.join(resolvedDir, 'index.html'), htmlContent)
  }

  private transformApexResults(apexMutationTestResult: ApexMutationTestResult) {
    const mutationTestResult = {
      schemaVersion: '2.0.0',
      config: {},
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

function resolveSafeOutputDir(outputDir: string): string {
  const resolved = path.resolve(outputDir)
  const cwd = path.resolve(process.cwd())
  if (resolved !== cwd && !resolved.startsWith(cwd + path.sep)) {
    throw new Error(
      `Report directory '${outputDir}' resolves outside the current working directory (${cwd}). Refusing to write reports outside the project root.`
    )
  }
  return resolved
}

const createReportHtml = (report: unknown, elementsBundle: string): string => {
  const safeJson = serializeReportForScript(report)
  const safeBundle = neutraliseScriptContent(elementsBundle)
  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Mutation Testing Report</title>
    <script>${safeBundle}</script>
  </head>
  <body>
    <mutation-test-report-app titlePostfix="apex-mutation-testing">
      Your browser doesn't support <a href="https://caniuse.com/#search=custom%20elements">custom elements</a>.
      Please use a latest version of an evergreen browser (Firefox, Chrome, Safari, Opera, Edge, etc).
    </mutation-test-report-app>
    <script id="mutation-report-data" type="application/json">${safeJson}</script>
    <script>
      const app = document.querySelector('mutation-test-report-app');
      app.report = JSON.parse(document.getElementById('mutation-report-data').textContent);
    </script>
  </body>
  </html>`
}

/**
 * Neutralise `</script` so a vendored bundle cannot prematurely close the host <script> tag.
 * The bundle is trusted (our own node_modules), but defensive escaping costs nothing.
 */
function neutraliseScriptContent(content: string): string {
  return content.replace(/<\/script/gi, '<\\/script')
}

/**
 * Serialise report data for safe embedding inside a <script type="application/json"> block.
 * Neutralises every character sequence a browser parser treats specially inside script content:
 * `</` (script-end sentinel), `<!--` (HTML comment open), `-->` (close), `<script`, and U+2028/2029.
 */
function serializeReportForScript(report: unknown): string {
  return JSON.stringify(report)
    .replace(/<\//g, '<\\/')
    .replace(/<!--/g, '<\\!--')
    .replace(/-->/g, '--\\>')
    .replace(/<script/gi, '<\\script')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
