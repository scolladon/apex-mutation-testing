import { readFile, realpath, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import type { Messages } from '@salesforce/core'
import * as path from 'path'

// Shared by every engine's reporter: each one maps its own result into this
// Stryker mutation-testing-report-schema (2.0.0) subset, and this module owns
// everything after that — where the page may be written, how the vendored
// bundle and the report data are embedded, and the file write itself.
//
// Local module-scope shape of the schema subset the reporters emit.
// mutation-testing-report-schema is only a transitive dependency — importing
// it directly would trip knip's lint:dependencies check — so the shape is
// declared here instead.
interface ReportLocation {
  start: { line: number; column: number }
  end: { line: number; column: number }
}

export interface ReportMutant {
  id: string
  mutatorName: string
  replacement: string
  // What the mutant changes, in words (schema 2.0.0): shown apart from
  // statusReason, which only ever says why the mutant ended as it did.
  description?: string
  status: string
  statusReason?: string
  static: boolean
  coveredBy?: string[]
  killedBy?: string[]
  testsCompleted: number
  location: ReportLocation
}

interface ReportFile {
  language: string
  source: string
  mutants: ReportMutant[]
}

export interface MutationTestResult {
  schemaVersion: string
  config: Record<string, unknown>
  thresholds: { high: number; low: number }
  files: Record<string, ReportFile>
  testFiles?: Record<string, { tests: { id: string; name: string }[] }>
}

export const REPORT_SCHEMA_VERSION = '2.0.0'
export const REPORT_THRESHOLDS = { high: 80, low: 60 }

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

// The caller validates that `outputDir` exists via the oclif
// `Flags.directory({ exists: true })` guard. We deliberately do NOT create
// the directory here: the plugin may be installed under a more privileged
// user than the one running the command, and auto-creating paths under that
// higher privilege would let a crafted `-r` flag write into locations the
// invoking user should not be able to touch.
//
// Two-stage path check:
//   1. string-level resolve rejects `../` traversal;
//   2. realpath rejects an existing symlink whose target is outside cwd.
//
// The bundle passed in must define error.reportDirOutsideCwd and
// error.reportDirSymlinkOutsideCwd.
export async function writeMutationReport(
  report: MutationTestResult,
  outputDir: string,
  messages: Messages<string>
): Promise<void> {
  const resolvedDir = resolveSafeOutputDir(outputDir, messages)
  await assertRealPathWithinCwd(resolvedDir, outputDir, messages)
  const bundle = await loadMutationTestElements()
  const htmlContent = createReportHtml(report, bundle)
  await writeFile(path.join(resolvedDir, 'index.html'), htmlContent)
}

function resolveSafeOutputDir(
  outputDir: string,
  messages: Messages<string>
): string {
  const resolved = path.resolve(outputDir)
  const cwd = path.resolve(process.cwd())
  if (resolved !== cwd && !resolved.startsWith(cwd + path.sep)) {
    throw new Error(
      messages.getMessage('error.reportDirOutsideCwd', [outputDir, cwd])
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
  originalInput: string,
  messages: Messages<string>
): Promise<void> {
  const realDir = await realpath(resolvedDir)
  const realCwd = await realpath(process.cwd())
  if (realDir !== realCwd && !realDir.startsWith(realCwd + path.sep)) {
    throw new Error(
      messages.getMessage('error.reportDirSymlinkOutsideCwd', [
        originalInput,
        realDir,
        realCwd,
      ])
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
 * whose source contained `<!--`, `-->` or `<script` into a blank page — a hazard
 * a Flow report, whose source is XML, would hit on its first comment.
 */
function serializeReportForScript(report: unknown): string {
  return JSON.stringify(report).replace(
    /[<>\u2028\u2029]/g,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}
