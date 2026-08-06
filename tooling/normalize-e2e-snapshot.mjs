import { readFileSync, writeFileSync } from 'node:fs'

const file = 'test/e2e/index.html'
const content = readFileSync(file, 'utf8')

// HTMLReporter now embeds the report JSON inside a data island
// `<script id="mutation-report-data" type="application/json">…</script>`
// and inlines the entire mutation-testing-elements bundle in a preceding
// `<script>…</script>` block. We strip the bundle (not what the e2e is
// asserting; ~500KB of churn on every regen) and normalise the JSON.
//
// The data island is escape-hardened by escaping < > and the line/paragraph
// separators as \uXXXX. Those are JSON escapes, so the island parses as-is and
// needs no reverse transform — only the same escaping reapplied on the way out.
const dataIslandRegex =
  /<script id="mutation-report-data" type="application\/json">([\s\S]+?)<\/script>/

const match = content.match(dataIslandRegex)
if (!match) {
  // biome-ignore lint/suspicious/noConsole: surface failure in build logs
  console.error('Could not find mutation-report-data script block in HTML')
  process.exit(1)
}

const escapeJsonIsland = s =>
  s.replaceAll(
    /[<>\u2028\u2029]/g,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  )

const report = JSON.parse(match[1])

const VOLATILE_PLACEHOLDER = 'E2E_TEST'

// `killedBy` and `testsCompleted` are the only report fields a rerun can
// legitimately change. The plugin runs tests with maxFailedTests: 0, so an
// async run aborts on the first failure — which of a mutant's covering
// methods gets there first is Salesforce's scheduling decision, not ours.
// Masking them keeps the snapshot a byte-comparison while leaving everything
// deterministic — coveredBy, testFiles, status, counts, locations — asserted
// exactly. Same treatment as the run timestamp baked into every mutant id.
const normaliseVolatileAttribution = mutant => {
  if (mutant.killedBy) {
    mutant.killedBy = [VOLATILE_PLACEHOLDER]
  }
  mutant.testsCompleted = 0
}

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
    normaliseVolatileAttribution(mutant)
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
