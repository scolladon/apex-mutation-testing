import {
  conflicts,
  testsForMutation,
} from '../../../src/service/mutationGrouper.js'
import { coverage, mutationAt } from './groupers/grouperTestFixtures.js'

describe('testsForMutation', () => {
  it('given a mutation whose line is mapped when looked up then returns the test set', () => {
    // Arrange
    const mutation = mutationAt(7)
    const map = coverage([[7, ['ta', 'tb']]])

    // Act
    const result = testsForMutation(mutation, map)

    // Assert
    expect(result).toEqual(new Set(['ta', 'tb']))
  })

  it('given a mutation whose line is missing from coverage when looked up then returns an empty set', () => {
    // Arrange
    const mutation = mutationAt(99)
    const map = coverage([[1, ['ta']]])

    // Act
    const result = testsForMutation(mutation, map)

    // Assert
    expect(result).toEqual(new Set())
  })
})

describe('conflicts', () => {
  it('given two disjoint sets when checked then returns false', () => {
    // Arrange & Act & Assert
    expect(conflicts(new Set(['a']), new Set(['b']))).toBe(false)
  })

  it('given a shared element across sets when checked then returns true', () => {
    // Arrange & Act & Assert
    expect(conflicts(new Set(['a', 'b']), new Set(['b', 'c']))).toBe(true)
  })

  it('given the larger set first when checked then still detects a shared element', () => {
    // Arrange — exercises the size-based ordering branch
    expect(conflicts(new Set(['a', 'b', 'c']), new Set(['c']))).toBe(true)
  })
})
