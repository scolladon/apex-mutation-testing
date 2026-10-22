import * as fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import * as path from 'node:path'
import type { FlowMutantStatus, FlowMutationReport } from '../types.js'

interface ReportMutant {
  id: string
  mutatorName: string
  replacement: string
  status: FlowMutantStatus
  statusReason?: string
  static: boolean
  coveredBy?: string[]
  killedBy?: string[]
  testsCompleted: number
  location: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
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
const ELEMENTS_BUNDLE =
  'mutation-testing-elements/dist/mutation-test-elements.js'
const MUTATION_TEST_ELEMENTS_PATH = requireFromHere.resolve(ELEMENTS_BUNDLE)

async function loadMutationTestElements(): Promise<string> {
  return fs.readFile(MUTATION_TEST_ELEMENTS_PATH, 'utf8')
}

export interface MutantLocationResult {
  location: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
  replacement: string
}

export function resolveMutantLocationAndReplacement(
  xml: string,
  originalSnippet: string,
  mutatedSnippet: string,
  preferredLine?: number
): MutantLocationResult {
  const lines = xml.split(/\r?\n/)

  const spellings: Array<{ original: string; replacement: string }> = [
    { original: originalSnippet, replacement: mutatedSnippet },
  ]

  // If snippet contains single quotes, it might be escaped as &apos; in XML
  if (originalSnippet.includes("'")) {
    spellings.push({
      original: originalSnippet.replace(/'/g, '&apos;'),
      replacement: mutatedSnippet.replace(/'/g, '&apos;'),
    })
  }

  // If snippet contains &&
  if (originalSnippet.includes('&&')) {
    spellings.push({
      original: originalSnippet.replace(/&&/g, '&amp;&amp;'),
      replacement: mutatedSnippet.replace(/&&/g, '&amp;&amp;'),
    })
  }

  if (originalSnippet.includes('&apos;')) {
    spellings.push({
      original: originalSnippet.replace(/&apos;/g, "'"),
      replacement: mutatedSnippet.replace(/&apos;/g, "'"),
    })
  }

  // 1. Try preferredLine first
  if (preferredLine && preferredLine >= 1 && preferredLine <= lines.length) {
    const line = lines[preferredLine - 1]
    for (const { original, replacement } of spellings) {
      const col = line.indexOf(original)
      if (col !== -1) {
        return {
          location: {
            start: { line: preferredLine, column: col + 1 },
            end: { line: preferredLine, column: col + 1 + original.length },
          },
          replacement,
        }
      }
    }
  }

  // 2. Search nearby lines (within +/- 20 lines of preferredLine)
  if (preferredLine) {
    for (let offset = 1; offset <= 20; offset++) {
      for (const targetLine of [
        preferredLine + offset,
        preferredLine - offset,
      ]) {
        if (targetLine >= 1 && targetLine <= lines.length) {
          const line = lines[targetLine - 1]
          for (const { original, replacement } of spellings) {
            const col = line.indexOf(original)
            if (col !== -1) {
              return {
                location: {
                  start: { line: targetLine, column: col + 1 },
                  end: { line: targetLine, column: col + 1 + original.length },
                },
                replacement,
              }
            }
          }
        }
      }
    }
  }

  // 3. Fallback search across the entire file
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const { original, replacement } of spellings) {
      const col = line.indexOf(original)
      if (col !== -1) {
        return {
          location: {
            start: { line: i + 1, column: col + 1 },
            end: { line: i + 1, column: col + 1 + original.length },
          },
          replacement,
        }
      }
    }
  }

  // 4. Ultimate fallback: highlight non-whitespace on preferredLine
  const targetLine =
    preferredLine && preferredLine >= 1 && preferredLine <= lines.length
      ? preferredLine
      : 1
  const lineStr = lines[targetLine - 1] || ''
  const nonWsMatch = lineStr.match(/\S/)
  const startCol = nonWsMatch ? lineStr.indexOf(nonWsMatch[0]) + 1 : 1
  return {
    location: {
      start: { line: targetLine, column: startCol },
      end: { line: targetLine, column: Math.max(lineStr.length, startCol + 1) },
    },
    replacement: mutatedSnippet,
  }
}

export function findLocationInXml(
  xml: string,
  snippet: string,
  preferredLine?: number
): {
  start: { line: number; column: number }
  end: { line: number; column: number }
} {
  return resolveMutantLocationAndReplacement(xml, snippet, '', preferredLine)
    .location
}

function neutraliseScriptContent(content: string): string {
  return content.replace(/<\/script/gi, '<\\/script')
}

function serializeReportForScript(report: unknown): string {
  return JSON.stringify(report).replace(
    /[<>\u2028\u2029]/g,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}

function createReportHtml(report: unknown, elementsBundle: string): string {
  const safeJson = serializeReportForScript(report)
  const safeBundle = neutraliseScriptContent(elementsBundle)
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Flow Mutation Testing Report</title>
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

export class FlowHTMLReporter {
  public async generateReport(
    report: FlowMutationReport,
    outputDir: string = 'mutations'
  ): Promise<string> {
    const resolvedDir = path.resolve(outputDir)
    await fs.mkdir(resolvedDir, { recursive: true })

    let originalXml = report.originalXml
    if (!originalXml && report.flowFilePath) {
      try {
        originalXml = await fs.readFile(report.flowFilePath, 'utf-8')
      } catch {
        originalXml = ''
      }
    }

    const bundle = await loadMutationTestElements()
    const reportData = this.transformFlowResults(report, originalXml ?? '')
    const htmlContent = createReportHtml(reportData, bundle)
    await fs.writeFile(
      path.join(resolvedDir, 'index.html'),
      htmlContent,
      'utf-8'
    )
    return resolvedDir
  }

  private transformFlowResults(
    report: FlowMutationReport,
    originalXml: string
  ): MutationTestResult {
    const flowFileName = path.basename(report.flowFilePath)

    const reportMutants: ReportMutant[] = report.mutants.map(m => {
      const { location, replacement } = resolveMutantLocationAndReplacement(
        originalXml,
        m.originalSnippet,
        m.mutatedSnippet,
        m.lineNumber
      )
      return {
        id: m.id,
        mutatorName: m.mutatorName,
        replacement,
        status: m.status,
        statusReason: m.description,
        static: false,
        coveredBy: m.status !== 'Pending' ? ['FlowTests'] : undefined,
        killedBy: m.killedBy && m.killedBy.length > 0 ? m.killedBy : undefined,
        testsCompleted: m.status === 'Pending' ? 0 : 1,
        location,
      }
    })

    return {
      schemaVersion: '2.0.0',
      config: {},
      thresholds: {
        high: 80,
        low: 60,
      },
      files: {
        [flowFileName]: {
          language: 'xml',
          source: originalXml,
          mutants: reportMutants,
        },
      },
    }
  }
}
