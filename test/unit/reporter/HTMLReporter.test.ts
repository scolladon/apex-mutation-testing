import { readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ApexMutationHTMLReporter } from '../../../src/reporter/HTMLReporter.js'
import { ApexMutationTestResult } from '../../../src/type/ApexMutationTestResult.js'
import type { TestClassResolution } from '../../../src/type/TestClassResolution.js'

vi.mock('node:fs/promises')

beforeEach(() => {
  // Default: readFile returns an empty mutation-test-elements stub so
  // generateReport can run without a real filesystem; individual tests
  // override as needed.
  vi.mocked(readFile).mockResolvedValue('/* MTE stub */')
  vi.mocked(writeFile).mockResolvedValue(undefined)
  // Default: realpath is identity (no symlinks present). Symlink tests override.
  vi.mocked(realpath).mockImplementation(async (p: unknown) => String(p))
})

interface ParsedReportMutant {
  id: string
  status: string
  coveredBy?: string[]
  killedBy?: string[]
  testsCompleted: number
  static: boolean
  location: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
}

interface ParsedReport {
  files: Record<string, { mutants: ParsedReportMutant[] }>
  testFiles?: Record<string, { tests: { id: string; name: string }[] }>
}

// Reads the JSON data block back out of the generated HTML exactly as the
// browser does — JSON.parse on the raw island, no reverse transform. That is
// the point: if the island were not valid JSON, this would throw rather than
// quietly repair the document before asserting on it.
const extractReport = (html: string): ParsedReport => {
  const reportMatch = html.match(
    /<script id="mutation-report-data" type="application\/json">(.+?)<\/script>/s
  )
  return JSON.parse(reportMatch![1]) as ParsedReport
}

// Self-mapping resolution: the class id equals its own display name and
// folded lookup key. Reproduces the pre-Id rendering for fixtures where the
// classId/displayName split is not what the test is about.
const resolutionsFor = (classIds: string[]): TestClassResolution[] =>
  classIds.map(classId => ({
    classId,
    displayName: classId,
    lookupKeys: [classId.toLowerCase()],
  }))

describe('HTMLReporter', () => {
  let sut: ApexMutationHTMLReporter
  const testResults: ApexMutationTestResult = {
    sourceFile: 'TestClass',
    sourceFileContent: 'public class TestClass {}',
    // Deliberately not alphabetical — pins that testFiles keys follow user
    // (perimeter) order, not a sort.
    testFiles: ['FooTest', 'BazTest', 'BarTest'],
    testClassResolutions: resolutionsFor(['FooTest', 'BarTest', 'BazTest']),
    mutants: [
      {
        id: '1',
        mutatorName: 'IncrementMutator',
        status: 'Killed',
        attribution: {
          coveredBy: ['BarTest.testA', 'FooTest.testA'],
          killedBy: ['FooTest.testA'],
          testsCompleted: 2,
        },
        location: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 10 },
        },
        replacement: '--',
        original: '++',
      },
      {
        id: '2',
        mutatorName: 'BoundaryConditionMutator',
        status: 'Survived',
        attribution: {
          coveredBy: ['FooTest.testB'],
          killedBy: [],
          testsCompleted: 1,
        },
        location: {
          start: { line: 2, column: 0 },
          end: { line: 2, column: 10 },
        },
        replacement: '>=',
        original: '<',
      },
      {
        id: '3',
        mutatorName: 'ArithmeticOperatorMutator',
        status: 'CompileError',
        statusReason:
          'Deployment failed:\n[TestClass.cls:3:5] Invalid operation',
        location: {
          start: { line: 3, column: 0 },
          end: { line: 3, column: 10 },
        },
        replacement: '-',
        original: '+',
      },
      {
        id: '4',
        mutatorName: 'NullReturnMutator',
        status: 'Killed',
        statusReason:
          'System.NullPointerException: Attempt to de-reference a null object',
        attribution: {
          coveredBy: ['BarTest.testB'],
          killedBy: ['BarTest.testB'],
          testsCompleted: 1,
        },
        location: {
          start: { line: 4, column: 0 },
          end: { line: 4, column: 10 },
        },
        replacement: 'null',
        original: 'new Object()',
      },
      {
        id: '5',
        mutatorName: 'ArithmeticOperatorMutator',
        status: 'Pending',
        location: {
          start: { line: 5, column: 0 },
          end: { line: 5, column: 10 },
        },
        replacement: '-',
        original: '+',
      },
    ],
  }

  beforeEach(() => {
    sut = new ApexMutationHTMLReporter()
  })

  describe('Given valid mutation test results, When generating report', () => {
    it('Then generates HTML content', async () => {
      // Act
      await sut.generateReport(testResults)

      // Assert
      expect(writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('<html>')
      )
    })

    it('Then writes index.html under the default reports directory', async () => {
      // Act — no outputDir supplied, so the default must be used
      await sut.generateReport(testResults)

      // Assert
      const [target] = vi.mocked(writeFile).mock.calls[0]
      expect(target).toBe(path.join(process.cwd(), 'reports', 'index.html'))
    })

    it('Then reads the mutation-testing-elements bundle as utf8 text', async () => {
      // Act
      await sut.generateReport(testResults)

      // Assert — an empty encoding would hand back a Buffer instead of a string
      expect(readFile).toHaveBeenCalledWith(
        expect.stringContaining('mutation-test-elements'),
        'utf8'
      )
    })

    it('Then emits the schema version, thresholds and language the report viewer expects', async () => {
      // Act
      await sut.generateReport(testResults)

      // Assert — these drive how mutation-testing-elements renders the page
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const report = JSON.parse(
        html.match(
          /<script id="mutation-report-data" type="application\/json">(.+?)<\/script>/s
        )![1]
      ) as {
        schemaVersion: string
        thresholds: { high: number; low: number }
        files: Record<string, { language: string }>
      }
      expect(report.schemaVersion).toBe('2.0.0')
      expect(report.thresholds).toEqual({ high: 80, low: 60 })
      expect(report.files['TestClass.cls'].language).toBe('java')
    })

    it('Then accepts an output directory that resolves to the working directory itself', async () => {
      // Act — '.' resolves to cwd exactly, the boundary of the containment
      // check; treating that as "outside" would reject a legitimate target.
      await sut.generateReport(testResults, '.')

      // Assert
      expect(writeFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'index.html'),
        expect.stringContaining('<html>')
      )
    })

    it('Then marks Pending mutants as untested', async () => {
      // Act
      await sut.generateReport(testResults)

      // Assert
      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string
      const reportMatch = htmlContent.match(
        /<script id="mutation-report-data" type="application\/json">(.+?)<\/script>/s
      )
      expect(reportMatch).not.toBeNull()
      const report = JSON.parse(reportMatch![1])
      const pendingMutant = report.files['TestClass.cls'].mutants.find(
        (m: { id: string }) => m.id === '5'
      )
      expect(pendingMutant.coveredBy).toBeUndefined()
      expect(pendingMutant.testsCompleted).toBe(0)
      expect(pendingMutant.status).toBe('Pending')
    })

    it('Then keys testFiles by the perimeter in user order, each observed id present exactly once with name equal to id', async () => {
      // Act
      await sut.generateReport(testResults)

      // Assert
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const report = extractReport(html)
      expect(Object.keys(report.testFiles!)).toEqual([
        'FooTest',
        'BazTest',
        'BarTest',
      ])
      expect(report.testFiles!.FooTest.tests).toEqual([
        { id: 'FooTest.testA', name: 'FooTest.testA' },
        { id: 'FooTest.testB', name: 'FooTest.testB' },
      ])
      expect(report.testFiles!.BarTest.tests).toEqual([
        { id: 'BarTest.testA', name: 'BarTest.testA' },
        { id: 'BarTest.testB', name: 'BarTest.testB' },
      ])
      // BazTest is in the perimeter but no mutant's attribution names it
      expect(report.testFiles!.BazTest.tests).toEqual([])
      const allIds = Object.values(report.testFiles!).flatMap(f =>
        f.tests.map(t => t.id)
      )
      expect(new Set(allIds).size).toBe(allIds.length)
    })

    // The committed e2e snapshot is validated by byte comparison, so this
    // ordering is load-bearing: without the sort it follows the org's per-test
    // coverage response order and the snapshot churns on every run.
    it('Then sorts each test file entry lexicographically, not by observed order', async () => {
      // Arrange
      const reversed = {
        ...testResults,
        testFiles: ['ZedTest'],
        testClassResolutions: resolutionsFor(['ZedTest']),
        mutants: [
          {
            ...testResults.mutants[0],
            attribution: {
              coveredBy: ['ZedTest.zeta', 'ZedTest.alpha'],
              killedBy: [],
              testsCompleted: 2,
            },
          },
        ],
      }

      // Act
      await sut.generateReport(reversed)

      // Assert
      const report = extractReport(
        vi.mocked(writeFile).mock.calls[0][1] as string
      )
      expect(report.testFiles!.ZedTest.tests.map(t => t.id)).toEqual([
        'ZedTest.alpha',
        'ZedTest.zeta',
      ])
    })

    it('Then emits per-mutant coveredBy, killedBy and testsCompleted from attribution', async () => {
      // Act
      await sut.generateReport(testResults)

      // Assert
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const report = extractReport(html)
      const mutants = report.files['TestClass.cls'].mutants
      const killedByBoth = mutants.find(m => m.id === '1')!
      expect(killedByBoth.coveredBy).toEqual(['BarTest.testA', 'FooTest.testA'])
      expect(killedByBoth.killedBy).toEqual(['FooTest.testA'])
      expect(killedByBoth.testsCompleted).toBe(2)

      const secondKilled = mutants.find(m => m.id === '4')!
      expect(secondKilled.coveredBy).toEqual(['BarTest.testB'])
      expect(secondKilled.killedBy).toEqual(['BarTest.testB'])
      expect(secondKilled.testsCompleted).toBe(1)
    })

    it('Then marks every mutant non-static and passes through its location coordinates', async () => {
      // Act
      await sut.generateReport(testResults)

      // Assert
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const report = extractReport(html)
      const mutant = report.files['TestClass.cls'].mutants.find(
        m => m.id === '1'
      )!
      expect(mutant.static).toBe(false)
      expect(mutant.location).toEqual({
        start: { line: 1, column: 0 },
        end: { line: 1, column: 10 },
      })
    })

    it('Then omits killedBy when the attribution killedBy array is empty', async () => {
      // Act
      await sut.generateReport(testResults)

      // Assert — mutant '2' is Survived: attribution.killedBy is []
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const report = extractReport(html)
      const survivedMutant = report.files['TestClass.cls'].mutants.find(
        m => m.id === '2'
      )!
      expect(survivedMutant.coveredBy).toEqual(['FooTest.testB'])
      expect(survivedMutant.killedBy).toBeUndefined()
    })

    it('Then omits coveredBy and killedBy and reports testsCompleted 0 when a mutant carries no attribution', async () => {
      // Act
      await sut.generateReport(testResults)

      // Assert — mutant '3' is a CompileError: no attribution was ever recorded
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const report = extractReport(html)
      const compileErrorMutant = report.files['TestClass.cls'].mutants.find(
        m => m.id === '3'
      )!
      expect(compileErrorMutant.coveredBy).toBeUndefined()
      expect(compileErrorMutant.killedBy).toBeUndefined()
      expect(compileErrorMutant.testsCompleted).toBe(0)
    })

    it('Then places an id case-insensitively under its differently-cased perimeter key', async () => {
      // Arrange — perimeter spelled uppercase (user input), id qualified from
      // a class id whose resolution folds to a lowercase lookup key
      const caseInsensitiveResults: ApexMutationTestResult = {
        sourceFile: 'TestClass',
        sourceFileContent: 'public class TestClass {}',
        testFiles: ['FOOTEST'],
        testClassResolutions: [
          {
            classId: 'FooTest',
            displayName: 'FooTest',
            lookupKeys: ['footest'],
          },
        ],
        mutants: [
          {
            id: '1',
            mutatorName: 'IncrementMutator',
            status: 'Killed',
            attribution: {
              coveredBy: ['FooTest.a'],
              killedBy: ['FooTest.a'],
              testsCompleted: 1,
            },
            location: {
              start: { line: 1, column: 0 },
              end: { line: 1, column: 10 },
            },
            replacement: '--',
            original: '++',
          },
        ],
      }

      // Act
      await sut.generateReport(caseInsensitiveResults)

      // Assert
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const report = extractReport(html)
      expect(report.testFiles!.FOOTEST.tests).toEqual([
        { id: 'FooTest.a', name: 'FooTest.a' },
      ])
    })

    it('Then omits testFiles entirely when no mutant in a dry-run report carries attribution', async () => {
      // Arrange — the dry-run shape: every mutant is Pending, none observed
      const dryRunResults: ApexMutationTestResult = {
        sourceFile: 'TestClass',
        sourceFileContent: 'public class TestClass {}',
        testFiles: ['FooTest'],
        testClassResolutions: resolutionsFor(['FooTest']),
        mutants: [
          {
            id: '1',
            mutatorName: 'IncrementMutator',
            status: 'Pending',
            location: {
              start: { line: 1, column: 0 },
              end: { line: 1, column: 10 },
            },
            replacement: '--',
            original: '++',
          },
        ],
      }

      // Act
      await sut.generateReport(dryRunResults)

      // Assert
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const report = extractReport(html)
      expect('testFiles' in report).toBe(false)
    })

    it('Then omits testFiles entirely when every mutant in the report is a CompileError', async () => {
      // Arrange — the all-compile-error shape: nothing was ever run
      const allCompileErrorResults: ApexMutationTestResult = {
        sourceFile: 'TestClass',
        sourceFileContent: 'public class TestClass {}',
        testFiles: ['FooTest'],
        testClassResolutions: resolutionsFor(['FooTest']),
        mutants: [
          {
            id: '1',
            mutatorName: 'IncrementMutator',
            status: 'CompileError',
            statusReason: 'Deployment failed: bad syntax',
            location: {
              start: { line: 1, column: 0 },
              end: { line: 1, column: 10 },
            },
            replacement: '--',
            original: '++',
          },
        ],
      }

      // Act
      await sut.generateReport(allCompileErrorResults)

      // Assert
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const report = extractReport(html)
      expect('testFiles' in report).toBe(false)
    })

    it('Then does NOT create the output directory (caller pre-validates existence)', async () => {
      // The CLI flag has `exists: true`; HTMLReporter must not create paths
      // under the plugin's privilege which could exceed the caller's.
      // Act
      await sut.generateReport(testResults)

      // Assert — only the two read-only filesystem calls plus writeFile
      expect(writeFile).toHaveBeenCalled()
      expect(readFile).toHaveBeenCalled()
      expect(realpath).toHaveBeenCalled()
    })

    it('Then rejects outputDir outside the current working directory', async () => {
      // Arrange & Act & Assert — Sec-F2: defence against arbitrary file write.
      // Match the string-resolve stage specifically: the later realpath stage
      // rejects '/tmp' too, so a looser pattern would pass even with the
      // string-level guard removed entirely.
      await expect(sut.generateReport(testResults, '/tmp')).rejects.toThrow(
        /resolves outside the current working directory/
      )
    })

    it('Then accepts outputDir inside cwd', async () => {
      // Arrange & Act — a subfolder of cwd must pass the sandbox check
      await sut.generateReport(testResults, 'reports/nested/path')

      // Assert
      expect(writeFile).toHaveBeenCalled()
    })

    it('Then neutralises a </script> sequence embedded in apex source', async () => {
      // Arrange — mutant source contains a would-be script-terminator
      const maliciousResults: ApexMutationTestResult = {
        sourceFile: 'Evil',
        sourceFileContent:
          'public class Evil { /* </script><script>alert(1) */ }',
        testFiles: ['EvilTest'],
        testClassResolutions: resolutionsFor(['EvilTest']),
        mutants: [
          {
            id: 'x',
            mutatorName: 'InlineConstantMutator',
            status: 'Killed',
            location: {
              start: { line: 1, column: 0 },
              end: { line: 1, column: 1 },
            },
            replacement: '</script><script>alert(1)</script>',
            original: '1',
          },
        ],
      }

      // Act
      await sut.generateReport(maliciousResults)

      // Assert — the raw '</script>' must NOT appear inside the JSON data block.
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const dataBlock = html.match(
        /<script id="mutation-report-data" type="application\/json">(.+?)<\/script>/s
      )![1]
      expect(dataBlock).not.toContain('</script>')
      expect(dataBlock).toContain('\\u003c')
    })

    // An Apex class that builds HTML or an email template carries these
    // sequences in ordinary string literals. Neutralising them with escapes
    // that are not valid JSON would leave the tokenizer safe but the document
    // unparseable, and the page would render blank.
    it('Then keeps the data block parseable when apex source carries comment and script sequences', async () => {
      // Arrange
      const htmlBuildingResults: ApexMutationTestResult = {
        sourceFile: 'Mailer',
        sourceFileContent:
          "public class Mailer { static String BODY = '<!-- header --> <script>x</script>'; }",
        testFiles: ['MailerTest'],
        testClassResolutions: resolutionsFor(['MailerTest']),
        mutants: [
          {
            id: 'x',
            mutatorName: 'InlineConstantMutator',
            status: 'Survived',
            location: {
              start: { line: 1, column: 0 },
              end: { line: 1, column: 1 },
            },
            replacement: '<!-- -->',
            original: '1',
          },
        ],
      }

      // Act
      await sut.generateReport(htmlBuildingResults)

      // Assert — parses as the browser would, and round-trips the source intact
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const result = extractReport(html)
      expect(result.files['Mailer.cls'].source).toBe(
        htmlBuildingResults.sourceFileContent
      )
    })

    it('Then rejects a symlinked outputDir that dereferences out of cwd', async () => {
      // Arrange — `reports` inside cwd is present (mkdir succeeds) but realpath
      // returns an out-of-cwd target, simulating a symlink pointing to /etc
      const cwd = process.cwd()
      vi.mocked(realpath).mockImplementation(async (p: unknown) => {
        const s = String(p)
        if (s === cwd) return cwd
        return '/etc/elsewhere'
      })

      // Act & Assert
      await expect(sut.generateReport(testResults, 'reports')).rejects.toThrow(
        /dereferences to '\/etc\/elsewhere', outside/
      )
    })

    it('Then accepts a symlink that still points inside cwd', async () => {
      // Arrange — realpath resolves to a nested dir inside cwd
      const cwd = process.cwd()
      vi.mocked(realpath).mockImplementation(async (p: unknown) => {
        const s = String(p)
        if (s === cwd) return cwd
        return `${cwd}/actual-reports`
      })

      // Act
      await sut.generateReport(testResults, 'reports')

      // Assert
      expect(writeFile).toHaveBeenCalled()
    })

    it('Then neutralises </script in the vendored mutation-testing-elements bundle', async () => {
      // Arrange — the vendored bundle may itself contain the sentinel (e.g. in
      // a template literal). Stub the readFile mock to include it.
      vi.mocked(readFile).mockResolvedValue(
        'var x = "</script><script>stolen</script>"'
      )

      // Act
      await sut.generateReport(testResults)

      // Assert
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      // The vendored block must not be able to close the host script
      const bundleBlock = html.match(/<script>([\s\S]+?)<\/script>/)![1]
      expect(bundleBlock).not.toContain('</script')
      expect(bundleBlock).toContain('<\\/script')
    })
  })

  describe('Given ids are qualified by an org class id, When generating report', () => {
    // CLASS_ID_LOCAL and CLASS_ID_FOREIGN are 18-character org Ids, distinct
    // from and not derivable from either class's display name — a fixture
    // where the id and the name are interchangeable could not tell a real
    // resolution-map render from a vacuous one.
    const CLASS_ID_LOCAL = '01pjV000000EE9ZQAW'
    const CLASS_ID_FOREIGN = '01pjV000000EE9bQAG'
    const resolvedResults: ApexMutationTestResult = {
      sourceFile: 'TestClass',
      sourceFileContent: 'public class TestClass {}',
      testFiles: ['Argument', 'mockery.Argument'],
      testClassResolutions: [
        {
          classId: CLASS_ID_LOCAL,
          displayName: 'Argument',
          lookupKeys: ['argument'],
        },
        {
          classId: CLASS_ID_FOREIGN,
          displayName: 'mockery.Argument',
          lookupKeys: ['mockery.argument'],
        },
      ],
      mutants: [
        {
          id: '1',
          mutatorName: 'IncrementMutator',
          status: 'Killed',
          attribution: {
            coveredBy: [
              `${CLASS_ID_LOCAL}.testFoo`,
              `${CLASS_ID_FOREIGN}.testFoo`,
            ],
            killedBy: [`${CLASS_ID_FOREIGN}.testFoo`],
            testsCompleted: 2,
          },
          location: {
            start: { line: 1, column: 0 },
            end: { line: 1, column: 10 },
          },
          replacement: '--',
          original: '++',
        },
      ],
    }

    it('Then testFiles groups each id under its own resolved display name', async () => {
      // Act
      await sut.generateReport(resolvedResults)

      // Assert
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const report = extractReport(html)
      expect(report.testFiles!['Argument'].tests).toEqual([
        { id: 'Argument.testFoo', name: 'Argument.testFoo' },
      ])
      expect(report.testFiles!['mockery.Argument'].tests).toEqual([
        { id: 'mockery.Argument.testFoo', name: 'mockery.Argument.testFoo' },
      ])
    })

    it('Then mutants render coveredBy and killedBy as resolved display names', async () => {
      // Act
      await sut.generateReport(resolvedResults)

      // Assert
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const report = extractReport(html)
      const mutant = report.files['TestClass.cls'].mutants[0]
      expect(mutant.coveredBy).toEqual([
        'Argument.testFoo',
        'mockery.Argument.testFoo',
      ])
      expect(mutant.killedBy).toEqual(['mockery.Argument.testFoo'])
    })

    it('Then no 18-character org id appears anywhere in the emitted report', async () => {
      // Act
      await sut.generateReport(resolvedResults)

      // Assert
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const report = extractReport(html)
      expect(JSON.stringify(report)).not.toMatch(/01p[A-Za-z0-9]{15}/)
    })

    it('Then a class id absent from the resolutions map renders the raw class id as the qualifier', async () => {
      // Arrange — this is the map-miss branch: visibly wrong beats plausibly
      // wrong, and the 100% branch gate requires this arm be reachable.
      const UNRESOLVED_CLASS_ID = '01pjV000000EE9zQAG'
      const missingResolutionResults: ApexMutationTestResult = {
        sourceFile: 'TestClass',
        sourceFileContent: 'public class TestClass {}',
        testFiles: ['Argument'],
        testClassResolutions: [],
        mutants: [
          {
            id: '1',
            mutatorName: 'IncrementMutator',
            status: 'Killed',
            attribution: {
              coveredBy: [`${UNRESOLVED_CLASS_ID}.testFoo`],
              killedBy: [`${UNRESOLVED_CLASS_ID}.testFoo`],
              testsCompleted: 1,
            },
            location: {
              start: { line: 1, column: 0 },
              end: { line: 1, column: 10 },
            },
            replacement: '--',
            original: '++',
          },
        ],
      }

      // Act
      await sut.generateReport(missingResolutionResults)

      // Assert
      const html = vi.mocked(writeFile).mock.calls[0][1] as string
      const report = extractReport(html)
      const mutant = report.files['TestClass.cls'].mutants[0]
      expect(mutant.coveredBy).toEqual([`${UNRESOLVED_CLASS_ID}.testFoo`])
    })

    it.each([
      ['Foo', 'acme.Foo'],
      ['acme.Foo', 'Foo'],
    ])(
      'Then a class answering to both a bare and a qualified perimeter spelling contributes its tests to only the first-listed entry (%s before %s)',
      async (first, second) => {
        // Arrange — an own-namespace class mints both spellings as lookup
        // keys (spellingsOf), so a perimeter naming both ('-t Foo -t
        // acme.Foo') would otherwise place the same test id under two
        // groups. The Stryker report schema treats tests[].id as globally
        // unique — coveredBy/killedBy link mutants to tests through it.
        // Parametrized over both orderings so "the first perimeter entry
        // wins" is pinned distinctly from "the bare spelling wins" — the two
        // claims coincide only when the bare spelling happens to be listed
        // first.
        const dualSpellingResults: ApexMutationTestResult = {
          sourceFile: 'TestClass',
          sourceFileContent: 'public class TestClass {}',
          testFiles: [first, second],
          testClassResolutions: [
            {
              classId: CLASS_ID_LOCAL,
              displayName: 'acme.Foo',
              lookupKeys: ['foo', 'acme.foo'],
            },
          ],
          mutants: [
            {
              id: '1',
              mutatorName: 'IncrementMutator',
              status: 'Killed',
              attribution: {
                coveredBy: [`${CLASS_ID_LOCAL}.testA`],
                killedBy: [`${CLASS_ID_LOCAL}.testA`],
                testsCompleted: 1,
              },
              location: {
                start: { line: 1, column: 0 },
                end: { line: 1, column: 10 },
              },
              replacement: '--',
              original: '++',
            },
          ],
        }

        // Act
        await sut.generateReport(dualSpellingResults)

        // Assert
        const html = vi.mocked(writeFile).mock.calls[0][1] as string
        const report = extractReport(html)
        expect(report.testFiles![first].tests).toEqual([
          { id: 'acme.Foo.testA', name: 'acme.Foo.testA' },
        ])
        expect(report.testFiles![second].tests).toEqual([])
      }
    )
  })
})
