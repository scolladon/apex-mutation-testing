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
        expect(runTestAsynchronousMock).toHaveBeenCalledWith({
          tests: [{ className: 'TestClass' }],
          testLevel: TestLevel.RunSpecifiedTests,
          skipCodeCoverage: true,
          maxFailedTests: 0,
        })
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
