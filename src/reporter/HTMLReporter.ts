import { readFile, realpath, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import * as path from 'path'
import { ApexMutationTestResult } from '../type/ApexMutationTestResult.js'
import { testClassOf } from '../type/TestMethodId.js'

// Local module-scope shape of the Stryker mutation-testing-report-schema
// (2.0.0) subset this reporter emits. mutation-testing-report-schema is only
// a transitive dependency — importing it directly would trip knip's
// lint:dependencies check — so the shape is declared here instead.
interface ReportMutant {
  id: string
  mutatorName: string
  replacement: string
  status: ApexMutationTestResult['mutants'][number]['status']
  statusReason?: string
  static: boolean
  coveredBy?: string[]
  killedBy?: string[]
  testsCompleted: number
  location: ApexMutationTestResult['mutants'][number]['location']
}

interface ReportFile {
  language: string
  source: string
  mutants: ReportMutant[]
}

interface MutationTestResult {
  schemaVersion: string
  config: Record<string, unknown>
  thresholds: { high: number; low: number }
  files: Record<string, ReportFile>
  testFiles?: Record<string, { tests: { id: string; name: string }[] }>
}

const requireFromHere = createRequire(import.meta.url)
// Resolved once at module scope. Stryker flips mutants at runtime, after the
// module graph is cached, so a mutant on this specifier is never re-executed
// and cannot be killed by any test — the standard static-mutant limitation.
// Stryker disable all: module-scope, never re-evaluated.
const ELEMENTS_BUNDLE =
  'mutation-testing-elements/dist/mutation-test-elements.js'
// Stryker restore all
const MUTATION_TEST_ELEMENTS_PATH = requireFromHere.resolve(ELEMENTS_BUNDLE)

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

  private transformApexResults(
    apexMutationTestResult: ApexMutationTestResult
  ): MutationTestResult {
    const testFiles = buildTestFilesSection(
      apexMutationTestResult.testFiles,
      apexMutationTestResult.mutants
    )
    const mutationTestResult: MutationTestResult = {
      schemaVersion: '2.0.0',
      config: {},
      thresholds: {
        high: 80,
        low: 60,
      },
      files: {},
      ...(testFiles && { testFiles }),
    }

    mutationTestResult.files[`${apexMutationTestResult.sourceFile}.cls`] = {
      language: 'java',
      source: apexMutationTestResult.sourceFileContent,
      mutants: apexMutationTestResult.mutants.map(mapMutant),
    }

    return mutationTestResult
  }
}

// observed = union of every mutant's attribution.coveredBy. Empty ⇒ no run
// data anywhere in this result (dry run, or every mutant a CompileError) ⇒
// omit testFiles entirely so the app renders no test view.
function buildTestFilesSection(
  perimeter: string[],
  mutants: ApexMutationTestResult['mutants']
): MutationTestResult['testFiles'] {
  const observed = new Set(
    mutants.flatMap(mutant => mutant.attribution?.coveredBy ?? [])
  )
  if (observed.size === 0) return undefined

  return Object.fromEntries(
    perimeter.map(className => {
      const tests = [...observed]
        .filter(id => testClassOf(id).toLowerCase() === className.toLowerCase())
        .sort()
        .map(id => ({ id, name: id }))
      return [className, { tests }]
    })
  )
}

function mapMutant(
  mutant: ApexMutationTestResult['mutants'][number]
): ReportMutant {
  const attribution = mutant.attribution
  return {
    id: mutant.id,
    mutatorName: mutant.mutatorName,
    replacement: mutant.replacement,
    status: mutant.status,
    statusReason: mutant.statusReason,
    static: false,
    coveredBy: attribution?.coveredBy,
    killedBy: attribution?.killedBy.length ? attribution.killedBy : undefined,
    testsCompleted: attribution?.testsCompleted ?? 0,
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
 *
 * Escaping `<` and `>` as \uXXXX removes every sequence a browser parser treats
 * specially inside script content — `</` (script-end sentinel), `<!--`, `-->`,
 * `<script` — because none of them can be spelled without one of those two
 * characters. U+2028/2029 are escaped for the same reason they always were.
 *
 * These are JSON escape sequences, so the island stays parseable as-is: the page
 * calls JSON.parse on it directly, and so can any reader. The previous scheme
 * inserted `\!`, `\>` and `\s`, which are not valid JSON escapes — it neutralised
 * the tokenizer but produced a document JSON.parse rejects, turning any report
 * whose Apex source contained `<!--`, `-->` or `<script` into a blank page.
 */
function serializeReportForScript(report: unknown): string {
  return JSON.stringify(report).replace(
    /[<>\u2028\u2029]/g,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}
