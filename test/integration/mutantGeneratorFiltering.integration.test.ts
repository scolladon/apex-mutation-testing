import { MutantGenerator } from '../../src/service/mutantGenerator.js'

describe('MutantGenerator filtering integration', () => {
  const apexCode = `public class MultiMutatorClass {
    public Integer calculate(Integer a, Integer b) {
        if (a > b) {
            return a + b;
        }
        Integer count = 0;
        count++;
        return count;
    }
}`

  const allLines = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])

  it('Given no filter, When computing, Then mutations from multiple mutator types returned', () => {
    // Arrange
    const sut = new MutantGenerator()

    // Act
    const result = sut.compute(apexCode, allLines)

    // Assert
    const mutatorNames = new Set(result.map(m => m.mutationName))
    expect(mutatorNames.has('BoundaryConditionMutator')).toBe(true)
    expect(mutatorNames.has('ArithmeticOperatorMutator')).toBe(true)
    expect(mutatorNames.has('IncrementMutator')).toBe(true)
  })

  it('Given include filter with only BoundaryCondition, When computing on code with arithmetic and boundary, Then only BoundaryCondition mutations returned', () => {
    // Arrange
    const sut = new MutantGenerator()

    // Act
    const result = sut.compute(apexCode, allLines, undefined, {
      include: ['BoundaryCondition'],
    })

    // Assert
    expect(result.length).toBeGreaterThan(0)
    expect(
      result.every(m => m.mutationName === 'BoundaryConditionMutator')
    ).toBe(true)
  })

  it('Given exclude filter with Increment, When computing on code with increments, Then no Increment mutations returned but other mutations present', () => {
    // Arrange
    const sut = new MutantGenerator()

    // Act
    const result = sut.compute(apexCode, allLines, undefined, {
      exclude: ['Increment'],
    })

    // Assert
    expect(result.length).toBeGreaterThan(0)
    expect(result.some(m => m.mutationName === 'IncrementMutator')).toBe(false)
    const mutatorNames = new Set(result.map(m => m.mutationName))
    expect(mutatorNames.size).toBeGreaterThan(1)
  })
})
