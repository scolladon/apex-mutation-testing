import { readFile, realpath, writeFile } from 'node:fs/promises'
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
    // The caller (run.ts) validates that `outputDir` exists via the oclif
    // `Flags.directory({ exists: true })` guard. We deliberately do NOT
    // create the directory here: the plugin may be installed under a more
    // privileged user than the one running the command, and auto-creating
    // paths under that higher privilege would let a crafted `-r` flag write
    // into locations the invoking user should not be able to touch.
    //
    // Two-stage path check:
    //   1. string-level resolve rejects `../` traversal;
    //   2. realpath rejects an existing symlink whose target is outside cwd.
    const resolvedDir = resolveSafeOutputDir(outputDir)
    await assertRealPathWithinCwd(resolvedDir, outputDir)
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

/**
 * Resolve symbolic links in the target directory and verify the dereferenced
 * path still lives inside cwd. Defeats attacks where a symlink `reports` → `/etc`
 * is present at cwd and the string-level check in resolveSafeOutputDir is satisfied.
 */
async function assertRealPathWithinCwd(
  resolvedDir: string,
  originalInput: string
): Promise<void> {
  const realDir = await realpath(resolvedDir)
  const realCwd = await realpath(process.cwd())
  if (realDir !== realCwd && !realDir.startsWith(realCwd + path.sep)) {
    throw new Error(
      `Report directory '${originalInput}' dereferences to '${realDir}', outside the current working directory (${realCwd}). Refusing to follow symlinks out of the project root.`
    )
  }
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
