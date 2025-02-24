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
      it('should complete the mutation testing process successfully when test is failing', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'class TestClass { }',
        }
        const mockMutations = [
          {
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
          },
        ]
        const mockTestResult: TestResult = {
          summary: { outcome: 'Fail' },
        } as TestResult
        ;(ApexClassRepository as jest.Mock).mockImplementation(() => ({
          read: jest.fn().mockResolvedValue(mockApexClass),
          update: jest.fn().mockResolvedValue({}),
        }))
        ;(MutantGenerator as jest.Mock).mockImplementation(() => ({
          compute: jest.fn().mockReturnValue(mockMutations),
          mutate: jest.fn().mockReturnValue('mutated code'),
        }))
        ;(ApexTestRunner as jest.Mock).mockImplementation(() => ({
          run: jest.fn().mockResolvedValue(mockTestResult),
        }))

        // Act
        const result = await sut.process()

        // Assert
        expect(result).toEqual({
          sourceFile: 'TestClass',
          sourceFileContent: mockApexClass.Body,
          testFile: 'TestClassTest',
          mutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'Killed',
              replacement: 'newCode',
              original: 'oldCode',
            }),
          ],
        })
        expect(spinner.start).toHaveBeenCalledTimes(3)
        expect(spinner.stop).toHaveBeenCalledTimes(3)
        expect(progress.start).toHaveBeenCalled()
        expect(progress.finish).toHaveBeenCalled()
      })

      it('should complete the mutation testing process successfully when test is passing', async () => {
        // Arrange
        const mockApexClass = {
          Id: '123',
          Body: 'class TestClass { }',
        }
        const mockMutations = [
          {
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
          },
        ]
        const mockTestResult: TestResult = {
          summary: { outcome: 'Pass' },
        } as TestResult
        ;(ApexClassRepository as jest.Mock).mockImplementation(() => ({
          read: jest.fn().mockResolvedValue(mockApexClass),
          update: jest.fn().mockResolvedValue({}),
        }))
        ;(MutantGenerator as jest.Mock).mockImplementation(() => ({
          compute: jest.fn().mockReturnValue(mockMutations),
          mutate: jest.fn().mockReturnValue('mutated code'),
        }))
        ;(ApexTestRunner as jest.Mock).mockImplementation(() => ({
          run: jest.fn().mockResolvedValue(mockTestResult),
        }))

        // Act
        const result = await sut.process()

        // Assert
        expect(result).toEqual({
          sourceFile: 'TestClass',
          sourceFileContent: mockApexClass.Body,
          testFile: 'TestClassTest',
          mutants: [
            expect.objectContaining({
              mutatorName: 'TestMutation',
              status: 'Survived',
              replacement: 'newCode',
              original: 'oldCode',
            }),
          ],
        })
        expect(spinner.start).toHaveBeenCalledTimes(3)
        expect(spinner.stop).toHaveBeenCalledTimes(3)
        expect(progress.start).toHaveBeenCalled()
        expect(progress.finish).toHaveBeenCalled()
      })

      it('should handle test runner exception and mark mutant as survived', async () => {
        // Arrange
        const mockApexClass = {
          Name: 'TestClass',
          Body: 'class TestClass {}',
        }
        const mockMutations = [
          {
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
          },
        ]
        ;(ApexClassRepository as jest.Mock).mockImplementation(() => ({
          read: jest.fn().mockResolvedValue(mockApexClass),
          update: jest.fn().mockResolvedValue({}),
        }))
        ;(MutantGenerator as jest.Mock).mockImplementation(() => ({
          compute: jest.fn().mockReturnValue(mockMutations),
          mutate: jest.fn().mockReturnValue('mutated code'),
        }))
        ;(ApexTestRunner as jest.Mock).mockImplementation(() => ({
          run: jest.fn().mockRejectedValue(new Error('Test runner failed')),
        }))

        // Act
        const result = await sut.process()

        // Assert
        expect(result).toEqual({
          sourceFile: 'TestClass',
          sourceFileContent: mockApexClass.Body,
          testFile: 'TestClassTest',
          mutants: [],
        })
        expect(spinner.start).toHaveBeenCalledTimes(3)
        expect(spinner.stop).toHaveBeenCalledTimes(3)
        expect(progress.start).toHaveBeenCalled()
        expect(progress.finish).toHaveBeenCalled()
      })

      it('should handle update failure and mark mutant as survived', async () => {
        // Arrange
        const mockApexClass = {
          Name: 'TestClass',
          Body: 'class TestClass {}',
        }
        const mockMutations = [
          {
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
          },
        ]
        ;(ApexClassRepository as jest.Mock).mockImplementation(() => ({
          read: jest.fn().mockResolvedValue(mockApexClass),
          update: jest.fn().mockRejectedValue(new Error('Update failed')),
        }))
        ;(MutantGenerator as jest.Mock).mockImplementation(() => ({
          compute: jest.fn().mockReturnValue(mockMutations),
          mutate: jest.fn().mockReturnValue('mutated code'),
        }))
        ;(ApexTestRunner as jest.Mock).mockImplementation(() => ({
          run: jest.fn().mockResolvedValue({}),
        }))

        // Act
        const result = await sut.process()

        // Assert
        expect(result).toEqual({
          sourceFile: 'TestClass',
          sourceFileContent: mockApexClass.Body,
          testFile: 'TestClassTest',
          mutants: [],
        })
        expect(spinner.start).toHaveBeenCalledTimes(3)
        expect(spinner.stop).toHaveBeenCalledTimes(3)
        expect(progress.start).toHaveBeenCalled()
        expect(progress.finish).toHaveBeenCalled()
      })
    })

    describe('When calculating mutation score', () => {
      it('should calculate correct score for mutants with kills', () => {
        // Arrange
        const mockResult = {
          sourceFile: 'TestClass',
          sourceFileContent: 'content',
          testFile: 'TestClassTest',
          mutants: [
            { status: 'Killed' },
            { status: 'Survived' },
            { status: 'Killed' },
          ],
        } as ApexMutationTestResult

        // Act
        const score = sut.calculateScore(mockResult)

        // Assert
        expect(score).toBe(66.66666666666666) // 2/3 * 100
      })

      it('should return 0 when there are no mutants', () => {
        // Arrange
        const mockResult = {
          sourceFile: 'TestClass',
          sourceFileContent: 'content',
          testFile: 'TestClassTest',
          mutants: [],
        }

        // Act
        const score = sut.calculateScore(mockResult)

        // Assert
        expect(score).toBe(0)
      })
    })
  })
})
