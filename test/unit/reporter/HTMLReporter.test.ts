import { writeFile } from 'node:fs/promises'
import { ApexMutationHTMLReporter } from '../../../src/reporter/HTMLReporter.js'
import { ApexMutationTestResult } from '../../../src/type/ApexMutationTestResult.js'

jest.mock('node:fs/promises')

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
    ],
  }

  beforeEach(() => {
    sut = new ApexMutationHTMLReporter()
  })

  describe('when generating report', () => {
    it('should generate HTML content with mutation results', async () => {
      // Act
      await sut.generateReport(testResults)

      // Assert
      expect(writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('<html>')
      )
    })
  })
})
