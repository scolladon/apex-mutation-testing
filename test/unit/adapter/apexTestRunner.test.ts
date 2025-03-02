import { TestLevel } from '@salesforce/apex-node'
import { Connection } from '@salesforce/core'
import { ApexTestRunner } from '../../../src/adapter/apexTestRunner.js'

const runTestAsynchronousMock = jest.fn()

jest.mock('@salesforce/apex-node', () => {
  return {
    TestService: jest.fn().mockImplementation(() => {
      return {
        // Mock the method you want to mock
        runTestAsynchronous: runTestAsynchronousMock,
      }
    }),
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
    jest.clearAllMocks()
  })

  describe('when getting covered lines', () => {
    describe('given the test execution is successful', () => {
      it('then should return a set of covered lines', async () => {
        // Arrange
        const mockTestResult = {
          codecoverage: [{ coveredLines: [1, 2, 3] }, { coveredLines: [4, 5] }],
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.getCoveredLines('TestClass')

        // Assert
        expect(result).toEqual(new Set([1, 2, 3, 4, 5]))
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
        await expect(sut.getCoveredLines('TestClass')).rejects.toThrow(
          'Test execution failed'
        )
      })
    })

    describe('given there is no code coverage data', () => {
      it('then should return an empty set', async () => {
        // Arrange
        const mockTestResult = {
          codecoverage: undefined,
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.getCoveredLines('TestClass')

        // Assert
        expect(result).toEqual(new Set())
      })
    })
  })

  describe('when running tests', () => {
    describe('given the test execution is successful', () => {
      it('then should return the test result', async () => {
        // Arrange
        const mockTestResult = {
          summary: {
            outcome: 'Pass',
          },
        }
        runTestAsynchronousMock.mockResolvedValue(mockTestResult)

        // Act
        const result = await sut.run('TestClass')

        // Assert
        expect(result).toEqual(mockTestResult)
        expect(runTestAsynchronousMock).toHaveBeenCalledWith(
          {
            tests: [{ className: 'TestClass' }],
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
        await expect(sut.run('TestClass')).rejects.toThrow(
          'Test execution failed'
        )
      })
    })
  })
})
