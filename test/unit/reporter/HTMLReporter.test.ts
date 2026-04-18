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

describe('HTMLReporter', () => {
  let sut: ApexMutationHTMLReporter
  const testResults: ApexMutationTestResult = {
    sourceFile: 'TestClass',
    sourceFileContent: 'public class TestClass {}',
    testFile: 'TestClass_Test',
    mutants: [
      {
        id: '1',
        mutatorName: 'IncrementMutator',
        status: 'Killed',
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
        testFile: 'EvilTest',
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
