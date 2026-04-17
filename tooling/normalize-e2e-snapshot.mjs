import { readFileSync, writeFileSync } from 'node:fs'

const file = 'test/e2e/index.html'
const content = readFileSync(file, 'utf8')

// HTMLReporter now embeds the report JSON inside a data island
// `<script id="mutation-report-data" type="application/json">…</script>`
// and inlines the entire mutation-testing-elements bundle in a preceding
// `<script>…</script>` block. We strip the bundle (not what the e2e is
// asserting; ~500KB of churn on every regen) and normalise the JSON.
//
// The data island is escape-hardened: </, <!--, -->, <script, and
// line/paragraph separators are backslash-escaped. Reverse those before
// JSON.parse, and reapply after re-serialising.
const dataIslandRegex =
  /<script id="mutation-report-data" type="application\/json">([\s\S]+?)<\/script>/

const match = content.match(dataIslandRegex)
if (!match) {
  // biome-ignore lint/suspicious/noConsole: surface failure in build logs
  console.error('Could not find mutation-report-data script block in HTML')
  process.exit(1)
}

const unescapeJsonIsland = s =>
  s
    .replaceAll('<\\/', '</')
    .replaceAll('<\\!--', '<!--')
    .replaceAll('--\\>', '-->')
    .replaceAll(/<\\script/gi, '<script')
    .replaceAll('\\u2028', '\u2028')
    .replaceAll('\\u2029', '\u2029')

const escapeJsonIsland = s =>
  s
    .replaceAll('</', '<\\/')
    .replaceAll('<!--', '<\\!--')
    .replaceAll('-->', '--\\>')
    .replaceAll(/<script/gi, '<\\script')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')

const report = JSON.parse(unescapeJsonIsland(match[1]))

for (const fileData of Object.values(report.files)) {
  fileData.mutants.sort((a, b) => {
    const lineDiff = a.location.start.line - b.location.start.line
    if (lineDiff !== 0) return lineDiff

    const colDiff = a.location.start.column - b.location.start.column
    if (colDiff !== 0) return colDiff

    const nameCmp = a.mutatorName.localeCompare(b.mutatorName)
    if (nameCmp !== 0) return nameCmp

    return a.replacement.localeCompare(b.replacement)
  })

  for (const mutant of fileData.mutants) {
    mutant.id = mutant.id.replace(/\d{13}/, 'E2E_TEST')
  }
}

const BUNDLE_PLACEHOLDER =
  '/* mutation-testing-elements bundle stripped for snapshot; not asserted */'

const STRIPPED_BUNDLE_REGEX = /<head>([\s\S]+?)<\/head>/

let normalised = content.replace(
  dataIslandRegex,
  `<script id="mutation-report-data" type="application/json">${escapeJsonIsland(
    JSON.stringify(report)
  )}</script>`
)

normalised = normalised.replace(STRIPPED_BUNDLE_REGEX, headContent => {
  return headContent.replace(
    /<script>[\s\S]+?<\/script>/,
    `<script>${BUNDLE_PLACEHOLDER}</script>`
  )
})

writeFileSync(file, normalised)
