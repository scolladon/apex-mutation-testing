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
      it('then should return a set of covered lines', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 1,
            failing: 0,
            testsRan: 1,
          },
          tests: [
            {
              methodName: 'testMethodA',
              perClassCoverage: [
                {
                  apexClassOrTriggerName: 'ApexClass',
                  apexTestMethodName: 'testMethodA',
                  coverage: {
                    coveredLines: [1, 2, 3],
                  },
                },
                {
                  apexClassOrTriggerName: 'ApexClass',
                  apexTestMethodName: 'testMethodB',
                  coverage: {
                    coveredLines: [4, 5],
                  },
                },
              ],
            },
          ],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.getTestMethodsPerLines(
          'TestClass',
          'ApexClass'
        )

        // Assert
        expect(result).toEqual({
          outcome: 'Passed',
          testsRan: 1,
          failing: 0,
          testMethodsPerLine: new Map([
            [1, new Set(['testMethodA'])],
            [2, new Set(['testMethodA'])],
            [3, new Set(['testMethodA'])],
            [4, new Set(['testMethodB'])],
            [5, new Set(['testMethodB'])],
          ]),
          aggregatedCoverageOnly: false,
        })
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

        // Act & Assert
        await expect(
          sut.getTestMethodsPerLines('TestClass', 'ApexClass')
        ).rejects.toThrow('Test execution failed')
      })
    })

    describe('given tests is null', () => {
      it('then should return empty testMethodsPerLine map', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 0,
            failing: 0,
            testsRan: 0,
          },
          tests: null,
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.getTestMethodsPerLines(
          'TestClass',
          'ApexClass'
        )

        // Assert
        expect(result.testMethodsPerLine).toEqual(new Map())
      })
    })

    describe('given perClassCoverage is null', () => {
      it('then should return empty testMethodsPerLine map', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 1,
            failing: 0,
            testsRan: 1,
          },
          tests: [{ methodName: 'testMethod', perClassCoverage: null }],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.getTestMethodsPerLines(
          'TestClass',
          'ApexClass'
        )

        // Assert
        expect(result.testMethodsPerLine).toEqual(new Map())
      })
    })

    describe('given the coverage entry belongs to another class', () => {
      it('then should not add its covered lines', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 1,
            failing: 0,
            testsRan: 1,
          },
          tests: [
            {
              methodName: 'testMethod',
              perClassCoverage: [
                {
                  apexClassOrTriggerName: 'SomeOtherClass',
                  apexTestMethodName: 'testMethod',
                  coverage: { coveredLines: [1, 2] },
                },
              ],
            },
          ],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.getTestMethodsPerLines(
          'TestClass',
          'ApexClass'
        )

        // Assert
        expect(result.testMethodsPerLine).toEqual(new Map())
      })
    })

    describe('given coverage is null', () => {
      it('then should return empty testMethodsPerLine map', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 1,
            failing: 0,
            testsRan: 1,
          },
          tests: [
            {
              methodName: 'testMethod',
              perClassCoverage: [
                {
                  apexClassOrTriggerName: 'ApexClass',
                  apexTestMethodName: 'testMethod',
                  coverage: null,
                },
              ],
            },
          ],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.getTestMethodsPerLines(
          'TestClass',
          'ApexClass'
        )

        // Assert
        expect(result.testMethodsPerLine).toEqual(new Map())
      })
    })

    describe('given coveredLines is null', () => {
      it('then should return empty testMethodsPerLine map', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 1,
            failing: 0,
            testsRan: 1,
          },
          tests: [
            {
              methodName: 'testMethod',
              perClassCoverage: [
                {
                  apexClassOrTriggerName: 'ApexClass',
                  apexTestMethodName: 'testMethod',
                  coverage: { coveredLines: null },
                },
              ],
            },
          ],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.getTestMethodsPerLines(
          'TestClass',
          'ApexClass'
        )

        // Assert
        expect(result.testMethodsPerLine).toEqual(new Map())
      })
    })

    describe('given multiple test methods cover the same line', () => {
      it('then should add to existing set', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 2,
            failing: 0,
            testsRan: 2,
          },
          tests: [
            {
              methodName: 'testMethodA',
              perClassCoverage: [
                {
                  apexClassOrTriggerName: 'ApexClass',
                  apexTestMethodName: 'testMethodA',
                  coverage: { coveredLines: [1, 2] },
                },
              ],
            },
            {
              methodName: 'testMethodB',
              perClassCoverage: [
                {
                  apexClassOrTriggerName: 'ApexClass',
                  apexTestMethodName: 'testMethodB',
                  coverage: { coveredLines: [1, 3] },
                },
              ],
            },
          ],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.getTestMethodsPerLines(
          'TestClass',
          'ApexClass'
        )

        // Assert
        expect(result.testMethodsPerLine.get(1)).toEqual(
          new Set(['testMethodA', 'testMethodB'])
        )
      })
    })

    describe('given there is no code coverage data', () => {
      it('then should return an empty set', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 0,
            failing: 0,
            testsRan: 0,
          },
          tests: [],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.getTestMethodsPerLines(
          'TestClass',
          'ApexClass'
        )

        // Assert
        expect(result).toEqual({
          failing: 0,
          outcome: 'Passed',
          testMethodsPerLine: new Map(),
          testsRan: 0,
          aggregatedCoverageOnly: false,
        })
      })
    })

    describe('given per-test coverage is empty but aggregate coverage has data', () => {
      it('then should fall back to aggregate covered lines for all test methods', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 2,
            failing: 0,
            testsRan: 2,
          },
          tests: [
            { methodName: 'testMethodA', perClassCoverage: [] },
            { methodName: 'testMethodB', perClassCoverage: [] },
          ],
          codecoverage: [
            {
              name: 'ApexClass',
              coveredLines: [10, 20],
              uncoveredLines: [],
            },
          ],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.getTestMethodsPerLines(
          'TestClass',
          'ApexClass'
        )

        // Assert
        expect(result.aggregatedCoverageOnly).toBe(true)
        expect(result.testMethodsPerLine).toEqual(
          new Map([
            [10, new Set(['testMethodA', 'testMethodB'])],
            [20, new Set(['testMethodA', 'testMethodB'])],
          ])
        )
      })
    })

    describe('given per-test and aggregate coverage are both empty', () => {
      it('then should return empty testMethodsPerLine map without falling back', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Passed',
            passing: 1,
            failing: 0,
            testsRan: 1,
          },
          tests: [{ methodName: 'testMethodA', perClassCoverage: [] }],
          codecoverage: [
            {
              name: 'SomeOtherClass',
              coveredLines: [],
              uncoveredLines: [],
            },
          ],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.getTestMethodsPerLines(
          'TestClass',
          'ApexClass'
        )

        // Assert
        expect(result.aggregatedCoverageOnly).toBe(false)
        expect(result.testMethodsPerLine).toEqual(new Map())
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
