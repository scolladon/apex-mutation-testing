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

    it('should mark Pending mutants as untested', async () => {
      // Act
      await sut.generateReport(testResults)

      // Assert
      const htmlContent = (writeFile as jest.Mock).mock.calls[0][1] as string
      const reportMatch = htmlContent.match(/app\.report = (.+);/)
      const report = JSON.parse(reportMatch![1].replace(/<"\+"/g, '<'))
      const pendingMutant = report.files['TestClass.cls'].mutants.find(
        (m: { id: string }) => m.id === '5'
      )
      expect(pendingMutant.coveredBy).toBeUndefined()
      expect(pendingMutant.testsCompleted).toBe(0)
      expect(pendingMutant.status).toBe('Pending')
    })
  })
})
