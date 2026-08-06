import { TestLevel } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import { ApexTestRunner } from '../../../src/adapter/apexTestRunner.js'
import type { TestMethodId } from '../../../src/type/TestMethodId.js'

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
          ['TestClass'],
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

    describe('given multiple test classes', () => {
      it('then should build one test entry per class in perimeter order', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 2,
            failing: 0,
            testsRan: 2,
          },
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)
        const strategyStub = {
          fidelity: 'per-test' as const,
          getTestMethodsPerLine: vi.fn().mockReturnValue(new Map()),
        }

        // Act
        await sut.getTestMethodsPerLines(['A', 'B'], strategyStub)

        // Assert
        expect(runTestAsynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ className: 'A' }, { className: 'B' }],
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
          sut.getTestMethodsPerLines(['TestClass'], strategyStub)
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
          new Set<TestMethodId>(['TestClass.testMethod'])
        )

        // Assert — a single-class id set reproduces the byte-identical
        // single-element payload (R16)
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

    describe('given a mixed-class id set', () => {
      it('then should fold the ids into one test entry per declaring class', async () => {
        // Arrange
        const mockTestResult = { summary: { outcome: 'Passed' } }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        await sut.runTestMethods(
          new Set<TestMethodId>(['A.testOne', 'A.testTwo', 'B.testThree'])
        )

        // Assert — the class list is derived from the ids alone
        expect(runTestAsynchronousMock).toHaveBeenCalledWith(
          {
            tests: [
              { className: 'A', testMethods: ['testOne', 'testTwo'] },
              { className: 'B', testMethods: ['testThree'] },
            ],
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
          sut.runTestMethods(new Set<TestMethodId>(['TestClass.testMethod']))
        ).rejects.toThrow('Test execution failed')
      })
    })
  })
})
