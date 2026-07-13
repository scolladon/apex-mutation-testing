import { TestLevel } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import { ApexTestRunner } from '../../../src/adapter/apexTestRunner.js'

const runTestAsynchronousMock = vi.fn()

vi.mock('@salesforce/apex-node', async importOriginal => {
  const actual = await importOriginal<typeof import('@salesforce/apex-node')>()
  return {
    ...actual,
    TestService: vi.fn().mockImplementation(
      class {
        runTestAsynchronous = runTestAsynchronousMock
      }
    ),
  }
})

describe('ApexTestRunner', () => {
  let connectionStub: Connection
  let sut: ApexTestRunner

  beforeEach(() => {
    connectionStub = {} as Connection
    sut = new ApexTestRunner(connectionStub)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('when getting covered lines', () => {
    describe('given the test execution is successful', () => {
      it('then should delegate coverage shaping to the injected strategy and return the trimmed result', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 1,
            failing: 0,
            testsRan: 1,
          },
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'per-test' as const,
          getTestMethodsPerLine: vi
            .fn()
            .mockReturnValue(new Map([[1, new Set(['testMethodA'])]])),
        }

        // Act
        const result = await sut.getTestMethodsPerLines(
          'TestClass',
          strategyStub
        )

        // Assert
        expect(result).toEqual({
          outcome: 'Passed',
          testsRan: 1,
          failing: 0,
          testMethodsPerLine: new Map([[1, new Set(['testMethodA'])]]),
        })
        expect(strategyStub.getTestMethodsPerLine).toHaveBeenCalledWith(
          mockTestResult
        )
        expect(runTestAsynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ className: 'TestClass' }],
            testLevel: TestLevel.RunSpecifiedTests,
            skipCodeCoverage: false,
            maxFailedTests: 0,
          },
          true
        )
      })
    })

    describe('given the test execution fails', () => {
      it('then should throw an error', async () => {
        // Arrange
        runTestAsynchronousMock.mockRejectedValue(
          new Error('Test execution failed')
        )
        const strategyStub = {
          fidelity: 'per-test' as const,
          getTestMethodsPerLine: vi.fn(),
        }

        // Act & Assert
        await expect(
          sut.getTestMethodsPerLines('TestClass', strategyStub)
        ).rejects.toThrow('Test execution failed')
      })
    })
  })

  describe('when running tests', () => {
    describe('given the test execution is successful', () => {
      it('then should return the test result', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
          },
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.runTestMethods(
          'TestClass',
          new Set<string>(['testMethod'])
        )

        // Assert
        expect(result).toEqual(mockTestResult)
        expect(runTestAsynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ className: 'TestClass', testMethods: ['testMethod'] }],
            testLevel: TestLevel.RunSpecifiedTests,
            skipCodeCoverage: true,
            maxFailedTests: 0,
          },
          false
        )
      })
    })

    describe('given the test execution fails', () => {
      it('then should throw an error', async () => {
        // Arrange
        runTestAsynchronousMock.mockRejectedValue(
          new Error('Test execution failed')
        )

        // Act & Assert
        await expect(
          sut.runTestMethods('TestClass', new Set<string>(['testMethod']))
        ).rejects.toThrow('Test execution failed')
      })
    })

    describe('given no test methods specified', () => {
      it('then should use default empty set', async () => {
        // Arrange
        const mockTestResult = {
          summary: { outcome: 'Passed' },
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.runTestMethods('TestClass')

        // Assert
        expect(result).toEqual(mockTestResult)
        expect(runTestAsynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ className: 'TestClass', testMethods: [] }],
            testLevel: TestLevel.RunSpecifiedTests,
            skipCodeCoverage: true,
            maxFailedTests: 0,
          },
          false
        )
      })
    })
  })
})
