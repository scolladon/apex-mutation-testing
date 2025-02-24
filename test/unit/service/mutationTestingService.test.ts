import { TestResult } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import { Progress, Spinner } from '@salesforce/sf-plugins-core'
import { ApexClassRepository } from '../../../src/adapter/apexClassRepository.js'
import { ApexTestRunner } from '../../../src/adapter/apexTestRunner.js'
import { MutantGenerator } from '../../../src/service/mutantGenerator.js'
import { MutationTestingService } from '../../../src/service/mutationTestingService.js'
import { ApexMutationTestResult } from '../../../src/type/ApexMutationTestResult.js'

jest.mock('../../../src/adapter/apexClassRepository.js')
jest.mock('../../../src/adapter/apexTestRunner.js')
jest.mock('../../../src/service/mutantGenerator.js')

describe('MutationTestingService', () => {
  let sut: MutationTestingService
  let progress: Progress
  let spinner: Spinner
  let connection: Connection

  const mockApexClass = {
    Id: '123',
    Name: 'TestClass',
    Body: 'class TestClass { }',
  }

  const mockMutation = {
    mutationName: 'TestMutation',
    replacement: 'newCode',
    token: {
      text: 'oldCode',
      symbol: {
        line: 1,
        charPositionInLine: 0,
        tokenIndex: 0,
      },
    },
  }

  beforeEach(() => {
    progress = {
      start: jest.fn(),
      update: jest.fn(),
      finish: jest.fn(),
    } as unknown as Progress

    spinner = {
      start: jest.fn(),
      stop: jest.fn(),
    } as unknown as Spinner

    connection = {} as Connection

    sut = new MutationTestingService(progress, spinner, connection, {
      apexClassName: 'TestClass',
      apexClassTestName: 'TestClassTest',
    })
  })

  describe('Given a mutation testing service', () => {
    describe('When processing mutations', () => {
      const testCases = [
        {
          description: 'when test is failing',
          testResult: { summary: { outcome: 'Fail' } } as TestResult,
          expectedStatus: 'Killed',
          error: null,
          updateError: null,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'Killed',
              replacement: 'newCode',
              original: 'oldCode',
            }),
          ],
        },
        {
          description: 'when test is passing',
          testResult: { summary: { outcome: 'Pass' } } as TestResult,
          expectedStatus: 'Survived',
          error: null,
          updateError: null,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'Survived',
              replacement: 'newCode',
              original: 'oldCode',
            }),
          ],
        },
        {
          description: 'when test runner throws exception',
          testResult: null,
          expectedStatus: 'Survived',
          error: new Error('Test runner failed'),
          updateError: null,
          expectedMutants: [],
        },
        {
          description: 'when update fails',
          testResult: {},
          expectedStatus: 'Survived',
          error: null,
          updateError: new Error('Update failed'),
          expectedMutants: [],
        },
      ]

      it.each(testCases)(
        'should handle $description',
        async ({ testResult, expectedMutants, error, updateError }) => {
          // Arrange
          ;(ApexClassRepository as jest.Mock).mockImplementation(() => ({
            read: jest.fn().mockResolvedValue(mockApexClass),
            update: jest
              .fn()
              [updateError ? 'mockRejectedValue' : 'mockResolvedValue'](
                updateError || {}
              ),
          }))
          ;(MutantGenerator as jest.Mock).mockImplementation(() => ({
            compute: jest.fn().mockReturnValue([mockMutation]),
            mutate: jest.fn().mockReturnValue('mutated code'),
          }))
          ;(ApexTestRunner as jest.Mock).mockImplementation(() => ({
            run: jest
              .fn()
              [error ? 'mockRejectedValue' : 'mockResolvedValue'](
                error || testResult
              ),
          }))

          // Act
          const result = await sut.process()

          // Assert
          expect(result).toEqual({
            sourceFile: 'TestClass',
            sourceFileContent: mockApexClass.Body,
            testFile: 'TestClassTest',
            mutants: expectedMutants,
          })
          expect(spinner.start).toHaveBeenCalledTimes(3)
          expect(spinner.stop).toHaveBeenCalledTimes(3)
          expect(progress.start).toHaveBeenCalled()
          expect(progress.finish).toHaveBeenCalled()
        }
      )
    })

    describe('When calculating mutation score', () => {
      const scoreTestCases = [
        {
          description: 'with kills',
          mutants: [
            { status: 'Killed' },
            { status: 'Survived' },
            { status: 'Killed' },
          ],
          expectedScore: 66.66666666666666,
        },
        {
          description: 'with no mutants',
          mutants: [],
          expectedScore: 0,
        },
      ]

      it.each(scoreTestCases)(
        'should calculate correct score $description',
        ({ mutants, expectedScore }) => {
          // Arrange
          const mockResult = {
            sourceFile: 'TestClass',
            sourceFileContent: 'content',
            testFile: 'TestClassTest',
            mutants,
          } as ApexMutationTestResult

          // Act
          const score = sut.calculateScore(mockResult)

          // Assert
          expect(score).toBe(expectedScore)
        }
      )
    })
  })
})
