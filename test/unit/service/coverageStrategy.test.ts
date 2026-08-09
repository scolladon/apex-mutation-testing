import {
  AggregateCoverageStrategy,
  PerTestCoverageStrategy,
} from '../../../src/service/coverageStrategy.js'
import type { ApexTestRunResult } from '../../../src/type/ApexTestRunResult.js'

const declaringClass = {
  name: 'ApexClassTest',
  namespacePrefix: '',
  fullName: 'ApexClassTest',
}

describe('PerTestCoverageStrategy', () => {
  let sut: PerTestCoverageStrategy

  beforeEach(() => {
    sut = new PerTestCoverageStrategy('ApexClass')
  })

  describe('when getting test methods per line', () => {
    describe('given the test execution is successful', () => {
      it('then should return a map of covered lines to qualified test methods', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              methodName: 'testMethodA',
              className: declaringClass.fullName,
              coverage: [
                {
                  className: 'ApexClass',
                  testMethodName: 'testMethodA',
                  detail: {
                    coveredLines: [1, 2, 3],
                  },
                },
                {
                  className: 'ApexClass',
                  testMethodName: 'testMethodB',
                  detail: {
                    coveredLines: [4, 5],
                  },
                },
              ],
            },
          ],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(
          new Map([
            [1, new Set(['ApexClassTest.testMethodA'])],
            [2, new Set(['ApexClassTest.testMethodA'])],
            [3, new Set(['ApexClassTest.testMethodA'])],
            [4, new Set(['ApexClassTest.testMethodB'])],
            [5, new Set(['ApexClassTest.testMethodB'])],
          ])
        )
      })
    })

    describe('given tests is null', () => {
      it('then should return an empty map', () => {
        // Arrange
        const mockTestResult = { tests: null } as unknown as ApexTestRunResult

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
          tests: [
            {
              methodName: 'testMethod',
              className: declaringClass.fullName,
              coverage: null,
            },
          ],
        } as unknown as ApexTestRunResult

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
              className: declaringClass.fullName,
              coverage: [
                {
                  className: 'SomeOtherClass',
                  testMethodName: 'testMethod',
                  detail: { coveredLines: [1, 2] },
                },
              ],
            },
          ],
        } as unknown as ApexTestRunResult

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
              className: declaringClass.fullName,
              coverage: [
                {
                  className: 'ApexClass',
                  testMethodName: 'testMethod',
                  detail: null,
                },
              ],
            },
          ],
        } as unknown as ApexTestRunResult

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
              className: declaringClass.fullName,
              coverage: [
                {
                  className: 'ApexClass',
                  testMethodName: 'testMethod',
                  detail: { coveredLines: null },
                },
              ],
            },
          ],
        } as unknown as ApexTestRunResult

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
              className: declaringClass.fullName,
              coverage: [
                {
                  className: 'ApexClass',
                  testMethodName: 'testMethodA',
                  detail: { coveredLines: [1, 2] },
                },
              ],
            },
            {
              methodName: 'testMethodB',
              className: declaringClass.fullName,
              coverage: [
                {
                  className: 'ApexClass',
                  testMethodName: 'testMethodB',
                  detail: { coveredLines: [1, 3] },
                },
              ],
            },
          ],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result.get(1)).toEqual(
          new Set(['ApexClassTest.testMethodA', 'ApexClassTest.testMethodB'])
        )
      })
    })

    describe('given tests is empty', () => {
      it('then should return an empty map', () => {
        // Arrange
        const mockTestResult = { tests: [] } as unknown as ApexTestRunResult

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
              className: declaringClass.fullName,
              coverage: [
                {
                  className: 'AccountService',
                  testMethodName: 't',
                  detail: { coveredLines: [1] },
                },
              ],
            },
          ],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map([[1, new Set(['ApexClassTest.t'])]]))
      })
    })

    describe('given two classes contribute coverage to the same line', () => {
      it('then should union their qualified test methods', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              methodName: 'testA',
              className: 'FooTest',
              coverage: [
                {
                  className: 'ApexClass',
                  testMethodName: 'testA',
                  detail: { coveredLines: [1] },
                },
              ],
            },
            {
              methodName: 'testB',
              className: 'BarTest',
              coverage: [
                {
                  className: 'ApexClass',
                  testMethodName: 'testB',
                  detail: { coveredLines: [1] },
                },
              ],
            },
          ],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(
          new Map([[1, new Set(['FooTest.testA', 'BarTest.testB'])]])
        )
      })
    })

    describe('given two classes declare the same method name but cover different lines', () => {
      it('then should keep the tokens distinct', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              methodName: 'testA',
              className: 'FooTest',
              coverage: [
                {
                  className: 'ApexClass',
                  testMethodName: 'testA',
                  detail: { coveredLines: [1] },
                },
              ],
            },
            {
              methodName: 'testA',
              className: 'BarTest',
              coverage: [
                {
                  className: 'ApexClass',
                  testMethodName: 'testA',
                  detail: { coveredLines: [2] },
                },
              ],
            },
          ],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(
          new Map([
            [1, new Set(['FooTest.testA'])],
            [2, new Set(['BarTest.testA'])],
          ])
        )
      })
    })

    describe('given the declaring class is namespaced', () => {
      it('then should qualify with the full namespace-qualified name', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              methodName: 'testA',
              className: 'ns.FooTest',
              coverage: [
                {
                  className: 'ApexClass',
                  testMethodName: 'testA',
                  detail: { coveredLines: [1] },
                },
              ],
            },
          ],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map([[1, new Set(['ns.FooTest.testA'])]]))
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
      it('then should assign every qualified test method to every covered line', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            { methodName: 'testMethodA', className: declaringClass.fullName },
            { methodName: 'testMethodB', className: declaringClass.fullName },
          ],
          classCoverage: [{ className: 'ApexClass', coveredLines: [10, 20] }],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(
          new Map([
            [
              10,
              new Set([
                'ApexClassTest.testMethodA',
                'ApexClassTest.testMethodB',
              ]),
            ],
            [
              20,
              new Set([
                'ApexClassTest.testMethodA',
                'ApexClassTest.testMethodB',
              ]),
            ],
          ])
        )
      })
    })

    describe('given the codecoverage entry belongs to another class', () => {
      it('then should return an empty map', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            { methodName: 'testMethodA', className: declaringClass.fullName },
          ],
          classCoverage: [
            { className: 'SomeOtherClass', coveredLines: [7, 8] },
          ],
        } as unknown as ApexTestRunResult

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
          tests: [
            { methodName: 'testMethodA', className: declaringClass.fullName },
          ],
          classCoverage: [
            { className: 'SomeOtherClass', coveredLines: [7, 8] },
            { className: 'ApexClass', coveredLines: [10] },
          ],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(
          new Map([[10, new Set(['ApexClassTest.testMethodA'])]])
        )
      })
    })

    describe('given tests is null', () => {
      it('then should map every covered line to an empty set', () => {
        // Arrange
        const mockTestResult = {
          tests: null,
          classCoverage: [{ className: 'ApexClass', coveredLines: [10] }],
        } as unknown as ApexTestRunResult

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
          tests: [
            { methodName: 'testMethodA', className: declaringClass.fullName },
          ],
          classCoverage: [{ className: 'ApexClass', coveredLines: null }],
        } as unknown as ApexTestRunResult

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
          tests: [
            { methodName: 'testMethodA', className: declaringClass.fullName },
          ],
        } as unknown as ApexTestRunResult

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
          tests: [{ methodName: 't', className: declaringClass.fullName }],
          classCoverage: [{ className: 'AccountService', coveredLines: [10] }],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map([[10, new Set(['ApexClassTest.t'])]]))
      })
    })

    describe('given two classes contribute tests', () => {
      it('then should return the qualified union of test methods', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              methodName: 'testA',
              className: 'FooTest',
            },
            {
              methodName: 'testB',
              className: 'BarTest',
            },
          ],
          classCoverage: [{ className: 'ApexClass', coveredLines: [10] }],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(
          new Map([[10, new Set(['FooTest.testA', 'BarTest.testB'])]])
        )
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
