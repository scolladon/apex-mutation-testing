import { readFile, realpath, writeFile } from 'node:fs/promises'
import { ApexMutationHTMLReporter } from '../../../src/reporter/HTMLReporter.js'
import { ApexMutationTestResult } from '../../../src/type/ApexMutationTestResult.js'

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
}

interface ParsedReport {
  files: Record<string, { mutants: ParsedReportMutant[] }>
  testFiles?: Record<string, { tests: { id: string; name: string }[] }>
}

// Reads the escape-hardened JSON data block back out of the generated HTML,
// reversing the same neutralising transforms the existing tests apply inline.
const extractReport = (html: string): ParsedReport => {
  const reportMatch = html.match(
    /<script id="mutation-report-data" type="application\/json">(.+?)<\/script>/s
  )
  const rawJson = reportMatch![1]
    .replace(/<\\\//g, '</')
    .replace(/<\\!--/g, '<!--')
    .replace(/--\\>/g, '-->')
    .replace(/<\\script/gi, '<script')
  return JSON.parse(rawJson) as ParsedReport
}

describe('HTMLReporter', () => {
  let sut: ApexMutationHTMLReporter
  const testResults: ApexMutationTestResult = {
    sourceFile: 'TestClass',
    sourceFileContent: 'public class TestClass {}',
    // Deliberately not alphabetical — pins that testFiles keys follow user
    // (perimeter) order, not a sort.
    testFiles: ['FooTest', 'BazTest', 'BarTest'],
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

    it('Then marks Pending mutants as untested', async () => {
      // Act
      await sut.generateReport(testResults)

      // Assert
      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string
      const reportMatch = htmlContent.match(
        /<script id="mutation-report-data" type="application\/json">(.+?)<\/script>/s
      )
      expect(reportMatch).not.toBeNull()
      // The data block is escape-hardened; reverse the neutralising transforms
      const rawJson = reportMatch![1]
        .replace(/<\\\//g, '</')
        .replace(/<\\!--/g, '<!--')
        .replace(/--\\>/g, '-->')
        .replace(/<\\script/gi, '<script')
      const report = JSON.parse(rawJson)
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
      // Arrange — perimeter spelled lowercase (user input), id qualified from
      // the org's fullName casing
      const caseInsensitiveResults: ApexMutationTestResult = {
        sourceFile: 'TestClass',
        sourceFileContent: 'public class TestClass {}',
        testFiles: ['footest'],
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
      expect(report.testFiles!.footest.tests).toEqual([
        { id: 'FooTest.a', name: 'FooTest.a' },
      ])
    })

    it('Then omits testFiles entirely when no mutant in a dry-run report carries attribution', async () => {
      // Arrange — the dry-run shape: every mutant is Pending, none observed
      const dryRunResults: ApexMutationTestResult = {
        sourceFile: 'TestClass',
        sourceFileContent: 'public class TestClass {}',
        testFiles: ['FooTest'],
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
      // Arrange & Act & Assert — Sec-F2: defence against arbitrary file write
      await expect(sut.generateReport(testResults, '/tmp')).rejects.toThrow(
        /outside the current working directory/
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
      // The neutralised form is <\/ ... matching our transform
      expect(dataBlock).toContain('<\\/script')
    })

    it('Then rejects a symlinked outputDir that dereferences out of cwd (Sec-LOW-1)', async () => {
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
})
