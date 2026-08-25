import {
  AggregateCoverageStrategy,
  PerTestCoverageStrategy,
} from '../../../src/service/coverageStrategy.js'
import type { ApexTestRunResult } from '../../../src/type/ApexTestRunResult.js'

// 18-character org Ids, pinned equal in width on both namespaced and
// non-namespaced orgs. TARGET_CLASS_ID and FOREIGN_CLASS_ID differ in more
// than case so a fixture using both can tell a real join from a vacuous one.
const TARGET_CLASS_ID = '01pjV000000EE9ZQAW'
const FOREIGN_CLASS_ID = '01pjV000000EE9bQAG'
// Same characters as TARGET_CLASS_ID, folded to lowercase — proves the Id
// join performs no case folding, unlike the name join it replaces.
const CASE_FOLDED_CLASS_ID = '01pjv000000ee9zqaw'

// The declaring TEST class's own id — a different fact from the coverage
// rows' classId above (that identifies the class UNDER mutation). Deliberately
// not derivable from 'ApexClassTest'/'FooTest'/'BarTest', so a fixture
// asserting on the qualified TestMethodId can tell a real id-based qualifier
// from one that silently still reads the display name.
const DECLARING_CLASS_ID = '01pjV000000EEw1QAG'
const FOO_DECLARING_CLASS_ID = '01pjV000000EEw2QAG'
const BAR_DECLARING_CLASS_ID = '01pjV000000EEw3QAG'
const NS_FOO_DECLARING_CLASS_ID = '01pjV000000EEw4QAG'

describe('PerTestCoverageStrategy', () => {
  let sut: PerTestCoverageStrategy

  beforeEach(() => {
    sut = new PerTestCoverageStrategy(TARGET_CLASS_ID)
  })

  describe('when getting test methods per line', () => {
    describe('given the test execution is successful', () => {
      it('then should return a map of covered lines to qualified test methods', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              classId: DECLARING_CLASS_ID,
              methodName: 'testMethodA',
              coverage: [
                {
                  classId: TARGET_CLASS_ID,
                  testMethodName: 'testMethodA',
                  detail: {
                    coveredLines: [1, 2, 3],
                  },
                },
                {
                  classId: TARGET_CLASS_ID,
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
            [1, new Set([`${DECLARING_CLASS_ID}.testMethodA`])],
            [2, new Set([`${DECLARING_CLASS_ID}.testMethodA`])],
            [3, new Set([`${DECLARING_CLASS_ID}.testMethodA`])],
            [4, new Set([`${DECLARING_CLASS_ID}.testMethodB`])],
            [5, new Set([`${DECLARING_CLASS_ID}.testMethodB`])],
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
              classId: DECLARING_CLASS_ID,
              methodName: 'testMethod',
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
              classId: DECLARING_CLASS_ID,
              methodName: 'testMethod',
              coverage: [
                {
                  classId: FOREIGN_CLASS_ID,
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

    describe('given two coverage rows with different class ids, only one of which is the target', () => {
      it('then should keep only the covered lines belonging to the target class id', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              classId: DECLARING_CLASS_ID,
              methodName: 'testRun',
              coverage: [
                {
                  classId: TARGET_CLASS_ID,
                  testMethodName: 'testRun',
                  detail: { coveredLines: [1, 2] },
                },
                {
                  classId: FOREIGN_CLASS_ID,
                  testMethodName: 'testRun',
                  detail: { coveredLines: [99] },
                },
              ],
            },
          ],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result.has(99)).toBe(false)
        expect(result).toEqual(
          new Map([
            [1, new Set([`${DECLARING_CLASS_ID}.testRun`])],
            [2, new Set([`${DECLARING_CLASS_ID}.testRun`])],
          ])
        )
      })
    })

    describe('given a coverage row whose class id differs from the target only by case', () => {
      it('then should exclude it', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              classId: DECLARING_CLASS_ID,
              methodName: 't',
              coverage: [
                {
                  classId: CASE_FOLDED_CLASS_ID,
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
        expect(result).toEqual(new Map())
      })
    })

    describe('given coverage is null', () => {
      it('then should return an empty map', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              classId: DECLARING_CLASS_ID,
              methodName: 'testMethod',
              coverage: [
                {
                  classId: TARGET_CLASS_ID,
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
              classId: DECLARING_CLASS_ID,
              methodName: 'testMethod',
              coverage: [
                {
                  classId: TARGET_CLASS_ID,
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
              classId: DECLARING_CLASS_ID,
              methodName: 'testMethodA',
              coverage: [
                {
                  classId: TARGET_CLASS_ID,
                  testMethodName: 'testMethodA',
                  detail: { coveredLines: [1, 2] },
                },
              ],
            },
            {
              classId: DECLARING_CLASS_ID,
              methodName: 'testMethodB',
              coverage: [
                {
                  classId: TARGET_CLASS_ID,
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
          new Set([
            `${DECLARING_CLASS_ID}.testMethodA`,
            `${DECLARING_CLASS_ID}.testMethodB`,
          ])
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

    describe('given two classes contribute coverage to the same line', () => {
      it('then should union their qualified test methods', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              classId: FOO_DECLARING_CLASS_ID,
              methodName: 'testA',
              coverage: [
                {
                  classId: TARGET_CLASS_ID,
                  testMethodName: 'testA',
                  detail: { coveredLines: [1] },
                },
              ],
            },
            {
              classId: BAR_DECLARING_CLASS_ID,
              methodName: 'testB',
              coverage: [
                {
                  classId: TARGET_CLASS_ID,
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
          new Map([
            [
              1,
              new Set([
                `${FOO_DECLARING_CLASS_ID}.testA`,
                `${BAR_DECLARING_CLASS_ID}.testB`,
              ]),
            ],
          ])
        )
      })
    })

    describe('given two classes declare the same method name but cover different lines', () => {
      it('then should keep the tokens distinct', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              classId: FOO_DECLARING_CLASS_ID,
              methodName: 'testA',
              coverage: [
                {
                  classId: TARGET_CLASS_ID,
                  testMethodName: 'testA',
                  detail: { coveredLines: [1] },
                },
              ],
            },
            {
              classId: BAR_DECLARING_CLASS_ID,
              methodName: 'testA',
              coverage: [
                {
                  classId: TARGET_CLASS_ID,
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
            [1, new Set([`${FOO_DECLARING_CLASS_ID}.testA`])],
            [2, new Set([`${BAR_DECLARING_CLASS_ID}.testA`])],
          ])
        )
      })
    })

    describe('given the declaring class is namespaced', () => {
      it('then should qualify with the class id, not the namespace-qualified display name', () => {
        // Arrange — the qualifier must key off classId, which carries no
        // namespace of its own, even for a namespaced declaring class.
        const mockTestResult = {
          tests: [
            {
              classId: NS_FOO_DECLARING_CLASS_ID,
              methodName: 'testA',
              coverage: [
                {
                  classId: TARGET_CLASS_ID,
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
        expect(result).toEqual(
          new Map([[1, new Set([`${NS_FOO_DECLARING_CLASS_ID}.testA`])]])
        )
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
    sut = new AggregateCoverageStrategy(TARGET_CLASS_ID)
  })

  describe('when getting test methods per line', () => {
    describe('given aggregate coverage data is present', () => {
      it('then should assign every qualified test method to every covered line', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              classId: DECLARING_CLASS_ID,
              methodName: 'testMethodA',
            },
            {
              classId: DECLARING_CLASS_ID,
              methodName: 'testMethodB',
            },
          ],
          classCoverage: [{ classId: TARGET_CLASS_ID, coveredLines: [10, 20] }],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(
          new Map([
            [
              10,
              new Set([
                `${DECLARING_CLASS_ID}.testMethodA`,
                `${DECLARING_CLASS_ID}.testMethodB`,
              ]),
            ],
            [
              20,
              new Set([
                `${DECLARING_CLASS_ID}.testMethodA`,
                `${DECLARING_CLASS_ID}.testMethodB`,
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
            {
              classId: DECLARING_CLASS_ID,
              methodName: 'testMethodA',
            },
          ],
          classCoverage: [{ classId: FOREIGN_CLASS_ID, coveredLines: [7, 8] }],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map())
      })
    })

    describe('given codecoverage rows for two classes, only one of which is the target', () => {
      it('then should use only the target class id covered lines', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              classId: DECLARING_CLASS_ID,
              methodName: 'testMethodA',
            },
          ],
          classCoverage: [
            { classId: TARGET_CLASS_ID, coveredLines: [1] },
            { classId: FOREIGN_CLASS_ID, coveredLines: [99] },
          ],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result.has(99)).toBe(false)
        expect(result).toEqual(
          new Map([[1, new Set([`${DECLARING_CLASS_ID}.testMethodA`])]])
        )
      })
    })

    describe('given tests is null', () => {
      it('then should map every covered line to an empty set', () => {
        // Arrange
        const mockTestResult = {
          tests: null,
          classCoverage: [{ classId: TARGET_CLASS_ID, coveredLines: [10] }],
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
            {
              classId: DECLARING_CLASS_ID,
              methodName: 'testMethodA',
            },
          ],
          classCoverage: [{ classId: TARGET_CLASS_ID, coveredLines: null }],
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
            {
              classId: DECLARING_CLASS_ID,
              methodName: 'testMethodA',
            },
          ],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map())
      })
    })

    describe('given a codecoverage row whose class id differs from the target only by case', () => {
      it('then should exclude it', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              classId: DECLARING_CLASS_ID,
              methodName: 't',
            },
          ],
          classCoverage: [
            { classId: CASE_FOLDED_CLASS_ID, coveredLines: [10] },
          ],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(new Map())
      })
    })

    describe('given two classes contribute tests', () => {
      it('then should return the qualified union of test methods', () => {
        // Arrange
        const mockTestResult = {
          tests: [
            {
              classId: FOO_DECLARING_CLASS_ID,
              methodName: 'testA',
            },
            {
              classId: BAR_DECLARING_CLASS_ID,
              methodName: 'testB',
            },
          ],
          classCoverage: [{ classId: TARGET_CLASS_ID, coveredLines: [10] }],
        } as unknown as ApexTestRunResult

        // Act
        const result = sut.getTestMethodsPerLine(mockTestResult)

        // Assert
        expect(result).toEqual(
          new Map([
            [
              10,
              new Set([
                `${FOO_DECLARING_CLASS_ID}.testA`,
                `${BAR_DECLARING_CLASS_ID}.testB`,
              ]),
            ],
          ])
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
