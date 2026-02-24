import { DryRunReporter } from '../../../src/reporter/DryRunReporter.js'
import { DryRunMutant } from '../../../src/type/DryRunMutant.js'

describe('DryRunReporter', () => {
  let sut: DryRunReporter

  beforeEach(() => {
    sut = new DryRunReporter()
  })

  describe('countByMutator', () => {
    it('Given empty mutants array, When countByMutator, Then returns empty map', () => {
      // Arrange
      const mutants: DryRunMutant[] = []

      // Act
      const result = sut.countByMutator(mutants)

      // Assert
      expect(result.size).toBe(0)
    })

    it('Given mutants with single mutator type, When countByMutator, Then returns map with one entry', () => {
      // Arrange
      const mutants: DryRunMutant[] = [
        {
          line: 1,
          mutatorName: 'ArithmeticOperator',
          original: '+',
          replacement: '-',
        },
        {
          line: 2,
          mutatorName: 'ArithmeticOperator',
          original: '*',
          replacement: '/',
        },
      ]

      // Act
      const result = sut.countByMutator(mutants)

      // Assert
      expect(result.size).toBe(1)
      expect(result.get('ArithmeticOperator')).toBe(2)
    })

    it('Given mutants with multiple mutator types, When countByMutator, Then returns map sorted by count descending', () => {
      // Arrange
      const mutants: DryRunMutant[] = [
        {
          line: 1,
          mutatorName: 'ArithmeticOperator',
          original: '+',
          replacement: '-',
        },
        {
          line: 2,
          mutatorName: 'BoundaryCondition',
          original: '<',
          replacement: '<=',
        },
        {
          line: 3,
          mutatorName: 'ArithmeticOperator',
          original: '*',
          replacement: '/',
        },
        {
          line: 4,
          mutatorName: 'ArithmeticOperator',
          original: '-',
          replacement: '+',
        },
        {
          line: 5,
          mutatorName: 'NegationMutator',
          original: '!true',
          replacement: 'true',
        },
      ]

      // Act
      const result = sut.countByMutator(mutants)

      // Assert
      const entries = [...result.entries()]
      expect(entries).toEqual([
        ['ArithmeticOperator', 3],
        ['BoundaryCondition', 1],
        ['NegationMutator', 1],
      ])
    })
  })
})
