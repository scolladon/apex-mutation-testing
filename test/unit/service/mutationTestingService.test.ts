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
    replacement: '0',
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
    describe('When test class fails', () => {
      it('then should throw an error', async () => {
        // Arrange
        ;(ApexClassRepository as jest.Mock).mockImplementation(() => ({
          read: jest.fn().mockResolvedValue(mockApexClass),
          getApexClassDependencies: jest
            .fn()
            .mockResolvedValue([] as MetadataComponentDependency[]),
        }))
        ;(ApexTestRunner as jest.Mock).mockImplementation(() => ({
          getTestMethodsPerLines: jest.fn().mockResolvedValue({
            outcome: 'Failed',
            passing: 0,
            failing: 1,
            testsRan: 1,
            testMethodsPerLine: new Map(),
          }),
        }))

        // Act & Assert
        await expect(sut.process()).rejects.toThrow(
          'Original tests failed! Cannot proceed with mutation testing.'
        )
      })
    })

    describe('When test class does not have any test methods', () => {
      it('then should throw an error', async () => {
        // Arrange
        ;(ApexClassRepository as jest.Mock).mockImplementation(() => ({
          read: jest.fn().mockResolvedValue(mockApexClass),
          getApexClassDependencies: jest
            .fn()
            .mockResolvedValue([] as MetadataComponentDependency[]),
        }))
        ;(ApexTestRunner as jest.Mock).mockImplementation(() => ({
          getTestMethodsPerLines: jest.fn().mockResolvedValue({
            outcome: 'Passed',
            passing: 0,
            failing: 0,
            testsRan: 0,
            testMethodsPerLine: new Map(),
          }),
        }))

        // Act & Assert
        await expect(sut.process()).rejects.toThrow(
          'No tests were executed! Check that:'
        )
      })
    })

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
          expectedSpinnerStops: 5,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'Killed',
              replacement: '0',
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
          expectedSpinnerStops: 5,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'Survived',
              replacement: '0',
              original: '42',
            }),
          ],
        },
        {
          description: 'when test runner throws runtime exception',
          testResult: null,
          expectedStatus: 'RuntimeError',
          error: new Error(
            'System.NullPointerException: Attempt to de-reference a null object'
          ),
          updateError: null,
          expectedSpinnerStops: 5,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'RuntimeError',
              statusReason:
                'System.NullPointerException: Attempt to de-reference a null object',
              replacement: '0',
              original: '42',
            }),
          ],
        },
        {
          description: 'when test runner throws governor limit exception',
          testResult: null,
          expectedStatus: 'Killed',
          error: new Error(
            'System.LimitException: LIMIT_USAGE_FOR_NS : Too many SOQL queries'
          ),
          updateError: null,
          expectedSpinnerStops: 5,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'Killed',
              replacement: '0',
              original: '42',
            }),
          ],
        },
        {
          description: 'when deployment fails with compile error',
          testResult: {
            summary: {
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
            },
          } as TestResult,
          expectedStatus: 'CompileError',
          error: null,
          updateError: new Error(
            'Deployment failed:\n[TestClass.cls:1:50] Invalid syntax'
          ),
          expectedSpinnerStops: 5,
          expectedMutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'CompileError',
              statusReason:
                'Deployment failed:\n[TestClass.cls:1:50] Invalid syntax',
              replacement: '0',
              original: '42',
            }),
          ],
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
            runTestMethods: jest.fn().mockImplementation(() => {
              // Subsequent calls - mutation tests
              if (error) {
                return Promise.reject(error)
              }
              return Promise.resolve(testResult)
            }),
            getTestMethodsPerLines: jest.fn().mockResolvedValue({
              outcome: 'Passed',
              passing: 1,
              failing: 0,
              testsRan: 1,
              testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
            }),
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
          expect(spinner.start).toHaveBeenCalledTimes(5)
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
        {
          description: 'with compile errors excluded from score',
          mutants: [
            { status: 'Killed' },
            { status: 'Survived' },
            { status: 'CompileError' },
          ],
          expectedScore: 50,
        },
        {
          description: 'with only compile errors',
          mutants: [{ status: 'CompileError' }, { status: 'CompileError' }],
          expectedScore: 0,
        },
        {
          description: 'with runtime errors counted as killed in score',
          mutants: [
            { status: 'Killed' },
            { status: 'Survived' },
            { status: 'RuntimeError' },
          ],
          expectedScore: 66.66666666666666,
        },
        {
          description: 'with only runtime errors',
          mutants: [{ status: 'RuntimeError' }, { status: 'RuntimeError' }],
          expectedScore: 100,
        },
        {
          description: 'with mixed compile and runtime errors',
          mutants: [
            { status: 'Killed' },
            { status: 'CompileError' },
            { status: 'RuntimeError' },
            { status: 'Survived' },
          ],
          expectedScore: 66.66666666666666,
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
