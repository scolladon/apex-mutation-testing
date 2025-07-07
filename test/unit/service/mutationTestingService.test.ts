import { TestResult } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import { Progress, Spinner } from '@salesforce/sf-plugins-core'
import { ApexClassRepository } from '../../../src/adapter/apexClassRepository.js'
import { ApexTestRunner } from '../../../src/adapter/apexTestRunner.js'
import { MutantGenerator } from '../../../src/service/mutantGenerator.js'
import { MutationTestingService } from '../../../src/service/mutationTestingService.js'
import { ApexMutationParameter } from '../../../src/type/ApexMutationParameter.js'
import { ApexMutationTestResult } from '../../../src/type/ApexMutationTestResult.js'
import { MetadataComponentDependency } from '../../../src/type/MetadataComponentDependency.js'

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
    Body: 'class TestClass { public static Integer getValue() { return 42; } }',
  }

  const mockMutation = {
    mutationName: 'TestMutation',
    replacement: 'newCode',
    target: {
      startToken: {
        line: 1,
        charPositionInLine: 50,
        tokenIndex: 5,
        startIndex: 60, // Position of "42" in the string
        stopIndex: 61, // End position of "42" (inclusive)
      },
      endToken: {
        line: 1,
        charPositionInLine: 51,
        tokenIndex: 5,
        startIndex: 60, // Position of "42" in the string
        stopIndex: 61, // End position of "42" (inclusive)
      },
      text: '42',
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
      apexTestClassName: 'TestClassTest',
    } as ApexMutationParameter)
  })

  describe('Given a mutation testing service', () => {
    describe('When processing mutations', () => {
      const testCases = [
        {
          description: 'when test is failing',
          testResult: {
            summary: {
              outcome: 'Failed',
              passing: 0,
              failing: 1,
              testsRan: 1,
            },
          } as TestResult,
          expectedStatus: 'Killed',
          error: null,
          updateError: null,
          expectedSpinnerStops: 6,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'Killed',
              replacement: 'newCode',
              original: '42',
            }),
          ],
        },
        {
          description: 'when test is passing',
          testResult: {
            summary: {
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
            },
          } as TestResult,
          expectedStatus: 'Survived',
          error: null,
          updateError: null,
          expectedSpinnerStops: 6,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'Survived',
              replacement: 'newCode',
              original: '42',
            }),
          ],
        },
        {
          description: 'when test runner throws exception',
          testResult: null,
          expectedStatus: 'Survived',
          error: new Error('Test runner failed'),
          updateError: null,
          expectedSpinnerStops: 6,
          expectedMutants: [],
        },
        {
          description: 'when update fails',
          testResult: {
            summary: {
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
            },
          } as TestResult,
          expectedStatus: 'Survived',
          error: null,
          updateError: new Error('Update failed'),
          expectedSpinnerStops: 6,
          expectedMutants: [],
        },
      ]

      it.each(testCases)(
        'should handle $description',
        async ({
          testResult,
          expectedMutants,
          error,
          updateError,
          expectedSpinnerStops,
        }) => {
          // Arrange
          ;(ApexClassRepository as jest.Mock).mockImplementation(() => ({
            read: jest.fn().mockResolvedValue(mockApexClass),
            update: jest
              .fn()
              [updateError ? 'mockRejectedValue' : 'mockResolvedValue'](
                updateError || {}
              ),
            getApexClassDependencies: jest.fn().mockResolvedValue([
              {
                Id: 'dep1',
                RefMetadataComponentType: 'ApexClass',
                RefMetadataComponentName: 'TestDep',
              },
              {
                Id: 'dep2',
                RefMetadataComponentType: 'StandardEntity',
                RefMetadataComponentName: 'Account',
              },
              {
                Id: 'dep3',
                RefMetadataComponentType: 'CustomObject',
                RefMetadataComponentName: 'Custom__c',
              },
            ] as MetadataComponentDependency[]),
          }))
          ;(MutantGenerator as jest.Mock).mockImplementation(() => ({
            compute: jest.fn().mockReturnValue([mockMutation]),
            mutate: jest.fn().mockReturnValue('mutated code'),
          }))
          ;(ApexTestRunner as jest.Mock).mockImplementation(() => ({
            run: jest
              .fn()
              .mockResolvedValueOnce({
                // First call - original test run
                summary: {
                  outcome: 'Passed',
                  passing: 1,
                  failing: 0,
                  testsRan: 1,
                },
              })
              .mockImplementation(() => {
                // Subsequent calls - mutation tests
                if (error) {
                  return Promise.reject(error)
                }
                return Promise.resolve(testResult)
              }),
            getCoveredLines: jest.fn().mockResolvedValue(new Set([1])),
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
          expect(spinner.start).toHaveBeenCalledTimes(6)
          expect(spinner.stop).toHaveBeenCalledTimes(expectedSpinnerStops)
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
