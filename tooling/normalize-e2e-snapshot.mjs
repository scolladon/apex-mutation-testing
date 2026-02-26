import { readFileSync, writeFileSync } from 'node:fs'

const file = 'test/e2e/index.html'
const content = readFileSync(file, 'utf8')

const reportRegex = /app\.report = (.+);/
const match = content.match(reportRegex)
if (!match) {
  console.error('Could not find report JSON in HTML')
  process.exit(1)
}

const rawJson = match[1].replaceAll('<"+"', '<')
const report = JSON.parse(rawJson)

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

const newJson = JSON.stringify(report)
const escapedJson = newJson.replaceAll('<', '<"+"')
const newContent = content.replace(reportRegex, `app.report = ${escapedJson};`)

writeFileSync(file, newContent)
