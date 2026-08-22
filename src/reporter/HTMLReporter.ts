import { readFile, realpath, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import * as path from 'path'
import { ApexMutationTestResult } from '../type/ApexMutationTestResult.js'
import type { TestClassResolution } from '../type/TestClassResolution.js'
import { testClassOf, testMethodOf } from '../type/TestMethodId.js'

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
    const resolutions = new Map(
      apexMutationTestResult.testClassResolutions.map(r => [r.classId, r])
    )
    const testFiles = buildTestFilesSection(
      apexMutationTestResult.testFiles,
      apexMutationTestResult.mutants,
      resolutions
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
      mutants: apexMutationTestResult.mutants.map(mutant =>
        mapMutant(mutant, resolutions)
      ),
    }

    return mutationTestResult
  }
}

// Every identity the report emits is a rendered display name — raw org Ids
// never leave the engine. On a map miss (see the "residual" note in
// mutationTestingService.ts) the raw class Id renders as the qualifier:
// visibly wrong beats plausibly wrong.
const displayOf = (
  id: string,
  resolutions: ReadonlyMap<string, TestClassResolution>
): string =>
  `${resolutions.get(testClassOf(id))?.displayName ?? testClassOf(id)}.${testMethodOf(id)}`

// observed = union of every mutant's attribution.coveredBy. Empty ⇒ no run
// data anywhere in this result (dry run, or every mutant a CompileError) ⇒
// omit testFiles entirely so the app renders no test view.
//
// A class's resolution can carry two lookup keys (its bare and its
// qualified spelling, for an own-namespace class — see spellingsOf), so a
// perimeter naming both ('-t Foo -t acme.Foo') would otherwise place the
// same test id under two groups. The Stryker report schema treats
// `tests[].id` as globally unique — coveredBy/killedBy link mutants to
// tests through it — so each classId is claimed by the first perimeter
// entry it answers to; a later spelling of the same class reports no
// tests of its own.
function buildTestFilesSection(
  perimeter: string[],
  mutants: ApexMutationTestResult['mutants'],
  resolutions: ReadonlyMap<string, TestClassResolution>
): MutationTestResult['testFiles'] {
  const observed = new Set(
    mutants.flatMap(mutant => mutant.attribution?.coveredBy ?? [])
  )
  if (observed.size === 0) return undefined

  const idsByClassId = new Map<string, string[]>()
  for (const id of observed) {
    const classId = testClassOf(id)
    idsByClassId.set(classId, [...(idsByClassId.get(classId) ?? []), id])
  }

  const claimedClassIds = new Set<string>()
  return Object.fromEntries(
    perimeter.map(className => {
      const key = className.toLowerCase()
      const claims = [...idsByClassId].filter(
        ([classId]) =>
          !claimedClassIds.has(classId) &&
          // Stryker disable next-line ArrayDeclaration: this is only ever
          // .includes()-checked against `key`, already toLowerCase()'d
          // above; the injected uppercase literal can never match.
          (resolutions.get(classId)?.lookupKeys ?? []).includes(key)
      )
      for (const [classId] of claims) claimedClassIds.add(classId)
      const tests = claims
        .flatMap(([, ids]) => ids)
        .map(id => displayOf(id, resolutions))
        .sort()
        .map(display => ({ id: display, name: display }))
      return [className, { tests }]
    })
  )
}

function mapMutant(
  mutant: ApexMutationTestResult['mutants'][number],
  resolutions: ReadonlyMap<string, TestClassResolution>
): ReportMutant {
  // Re-sorted after resolution, not before: the engine sorts these by
  // TestMethodId, which is class-id-qualified, so the order it produces is
  // stable but keyed on something no reader of the report can see. Sorting the
  // rendered display names is what makes the report deterministic in the
  // reader's own terms — and is what the e2e snapshot asserts byte-for-byte.
  const attribution = mutant.attribution
    ? {
        coveredBy: mutant.attribution.coveredBy
          .map(id => displayOf(id, resolutions))
          .sort(),
        killedBy: mutant.attribution.killedBy
          .map(id => displayOf(id, resolutions))
          .sort(),
        testsCompleted: mutant.attribution.testsCompleted,
      }
    : undefined
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
