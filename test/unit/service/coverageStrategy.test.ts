import type { TestResult } from '@salesforce/apex-node'
import {
  AggregateCoverageStrategy,
  PerTestCoverageStrategy,
} from '../../../src/service/coverageStrategy.js'

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
              apexClass: declaringClass,
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
          tests: [
            {
              methodName: 'testMethod',
              apexClass: declaringClass,
              perClassCoverage: null,
            },
          ],
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
              apexClass: declaringClass,
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
              apexClass: declaringClass,
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
              apexClass: declaringClass,
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
              apexClass: declaringClass,
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
              apexClass: declaringClass,
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
        expect(result.get(1)).toEqual(
          new Set(['ApexClassTest.testMethodA', 'ApexClassTest.testMethodB'])
        )
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
              apexClass: declaringClass,
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
              apexClass: {
                name: 'FooTest',
                namespacePrefix: '',
                fullName: 'FooTest',
              },
              perClassCoverage: [
                {
                  apexClassOrTriggerName: 'ApexClass',
                  apexTestMethodName: 'testA',
                  coverage: { coveredLines: [1] },
                },
              ],
            },
            {
              methodName: 'testB',
              apexClass: {
                name: 'BarTest',
                namespacePrefix: '',
                fullName: 'BarTest',
              },
              perClassCoverage: [
                {
                  apexClassOrTriggerName: 'ApexClass',
                  apexTestMethodName: 'testB',
                  coverage: { coveredLines: [1] },
                },
              ],
            },
          ],
        } as unknown as TestResult

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
              apexClass: {
                name: 'FooTest',
                namespacePrefix: '',
                fullName: 'FooTest',
              },
              perClassCoverage: [
                {
                  apexClassOrTriggerName: 'ApexClass',
                  apexTestMethodName: 'testA',
                  coverage: { coveredLines: [1] },
                },
              ],
            },
            {
              methodName: 'testA',
              apexClass: {
                name: 'BarTest',
                namespacePrefix: '',
                fullName: 'BarTest',
              },
              perClassCoverage: [
                {
                  apexClassOrTriggerName: 'ApexClass',
                  apexTestMethodName: 'testA',
                  coverage: { coveredLines: [2] },
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
              apexClass: {
                name: 'FooTest',
                namespacePrefix: 'ns',
                fullName: 'ns.FooTest',
              },
              perClassCoverage: [
                {
                  apexClassOrTriggerName: 'ApexClass',
                  apexTestMethodName: 'testA',
                  coverage: { coveredLines: [1] },
                },
              ],
            },
          ],
        } as unknown as TestResult

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
            { methodName: 'testMethodA', apexClass: declaringClass },
            { methodName: 'testMethodB', apexClass: declaringClass },
          ],
          codecoverage: [{ name: 'ApexClass', coveredLines: [10, 20] }],
        } as unknown as TestResult

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
          tests: [{ methodName: 'testMethodA', apexClass: declaringClass }],
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
          tests: [{ methodName: 'testMethodA', apexClass: declaringClass }],
          codecoverage: [
            { name: 'SomeOtherClass', coveredLines: [7, 8] },
            { name: 'ApexClass', coveredLines: [10] },
          ],
        } as unknown as TestResult

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
          tests: [{ methodName: 'testMethodA', apexClass: declaringClass }],
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
          tests: [{ methodName: 'testMethodA', apexClass: declaringClass }],
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
          tests: [{ methodName: 't', apexClass: declaringClass }],
          codecoverage: [{ name: 'AccountService', coveredLines: [10] }],
        } as unknown as TestResult

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
              apexClass: {
                name: 'FooTest',
                namespacePrefix: '',
                fullName: 'FooTest',
              },
            },
            {
              methodName: 'testB',
              apexClass: {
                name: 'BarTest',
                namespacePrefix: '',
                fullName: 'BarTest',
              },
            },
          ],
          codecoverage: [{ name: 'ApexClass', coveredLines: [10] }],
        } as unknown as TestResult

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
