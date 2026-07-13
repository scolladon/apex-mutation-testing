import type { TestResult } from '@salesforce/apex-node'
import {
  AggregateCoverageStrategy,
  PerTestCoverageStrategy,
} from '../../../src/service/coverageStrategy.js'

describe('PerTestCoverageStrategy', () => {
  let sut: PerTestCoverageStrategy

  beforeEach(() => {
    sut = new PerTestCoverageStrategy('ApexClass')
  })

  describe('when getting test methods per line', () => {
    describe('given the test execution is successful', () => {
      it('then should return a map of covered lines to test methods', () => {
        // Arrange
        const mockTestResult = {
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
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(
          new Map([
            [1, new Set(['testMethodA'])],
            [2, new Set(['testMethodA'])],
            [3, new Set(['testMethodA'])],
            [4, new Set(['testMethodB'])],
            [5, new Set(['testMethodB'])],
          ])
        )
      })
    })

    describe('given tests is null', () => {
      it('then should return an empty map', () => {
        // Arrange
        const mockTestResult = { tests: null } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map())
      })
    })

    describe('given perClassCoverage is null', () => {
      it('then should return an empty map', () => {
        // Arrange
        const mockTestResult = {
          tests: [{ methodName: 'testMethod', perClassCoverage: null }],
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map())
      })
    })

    describe('given the coverage entry belongs to another class', () => {
      it('then should not add its covered lines', () => {
        // Arrange
        const mockTestResult = {
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
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map())
      })
    })

    describe('given coverage is null', () => {
      it('then should return an empty map', () => {
        // Arrange
        const mockTestResult = {
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
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map())
      })
    })

    describe('given coveredLines is null', () => {
      it('then should return an empty map', () => {
        // Arrange
        const mockTestResult = {
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
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map())
      })
    })

    describe('given multiple test methods cover the same line', () => {
      it('then should add to existing set', () => {
        // Arrange
        const mockTestResult = {
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
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result.get(1)).toEqual(new Set(['testMethodA', 'testMethodB']))
      })
    })

    describe('given tests is empty', () => {
      it('then should return an empty map', () => {
        // Arrange
        const mockTestResult = { tests: [] } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map())
      })
    })

    describe('given the class name differs only by case', () => {
      it('then should still match the coverage entry', () => {
        // Arrange
        sut = new PerTestCoverageStrategy('accountService')
        const mockTestResult = {
          tests: [
            {
              methodName: 't',
              perClassCoverage: [
                {
                  apexClassOrTriggerName: 'AccountService',
                  apexTestMethodName: 't',
                  coverage: { coveredLines: [1] },
                },
              ],
            },
          ],
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map([[1, new Set(['t'])]]))
      })
    })
  })

  describe('when reporting fidelity', () => {
    it('then should be per-test', () => {
      // Assert
      expect(sut.fidelity).toBe('per-test')
    })
  })
})

describe('AggregateCoverageStrategy', () => {
  let sut: AggregateCoverageStrategy

  beforeEach(() => {
    sut = new AggregateCoverageStrategy('ApexClass')
  })

  describe('when getting test methods per line', () => {
    describe('given aggregate coverage data is present', () => {
      it('then should assign every test method to every covered line', () => {
        // Arrange
        const mockTestResult = {
          tests: [{ methodName: 'testMethodA' }, { methodName: 'testMethodB' }],
          codecoverage: [{ name: 'ApexClass', coveredLines: [10, 20] }],
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(
          new Map([
            [10, new Set(['testMethodA', 'testMethodB'])],
            [20, new Set(['testMethodA', 'testMethodB'])],
          ])
        )
      })
    })

    describe('given the codecoverage entry belongs to another class', () => {
      it('then should return an empty map', () => {
        // Arrange
        const mockTestResult = {
          tests: [{ methodName: 'testMethodA' }],
          codecoverage: [{ name: 'SomeOtherClass', coveredLines: [7, 8] }],
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map())
      })
    })

    describe('given codecoverage entries for several classes', () => {
      it('then should use only the target class covered lines', () => {
        // Arrange
        const mockTestResult = {
          tests: [{ methodName: 'testMethodA' }],
          codecoverage: [
            { name: 'SomeOtherClass', coveredLines: [7, 8] },
            { name: 'ApexClass', coveredLines: [10] },
          ],
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map([[10, new Set(['testMethodA'])]]))
      })
    })

    describe('given tests is null', () => {
      it('then should map every covered line to an empty set', () => {
        // Arrange
        const mockTestResult = {
          tests: null,
          codecoverage: [{ name: 'ApexClass', coveredLines: [10] }],
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map([[10, new Set()]]))
      })
    })

    describe('given coveredLines is null', () => {
      it('then should return an empty map', () => {
        // Arrange
        const mockTestResult = {
          tests: [{ methodName: 'testMethodA' }],
          codecoverage: [{ name: 'ApexClass', coveredLines: null }],
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map())
      })
    })

    describe('given codecoverage is absent', () => {
      it('then should return an empty map', () => {
        // Arrange
        const mockTestResult = {
          tests: [{ methodName: 'testMethodA' }],
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map())
      })
    })

    describe('given the class name differs only by case', () => {
      it('then should still match the codecoverage entry', () => {
        // Arrange
        sut = new AggregateCoverageStrategy('accountService')
        const mockTestResult = {
          tests: [{ methodName: 't' }],
          codecoverage: [{ name: 'AccountService', coveredLines: [10] }],
        } as unknown as TestResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map([[10, new Set(['t'])]]))
      })
    })
  })

  describe('when reporting fidelity', () => {
    it('then should be aggregate', () => {
      // Assert
      expect(sut.fidelity).toBe('aggregate')
    })
  })
})
