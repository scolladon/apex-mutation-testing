import {
  assertGroupingInvariants,
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

describe('assertGroupingInvariants', () => {
  it('given a valid partition when asserted then does not throw', () => {
    // Arrange
    const m1 = mutationAt(1)
    const m2 = mutationAt(2)
    const groups = [{ mutations: [m1, m2], testMethods: new Set<string>() }]

    // Act & Assert
    expect(() => assertGroupingInvariants([m1, m2], groups)).not.toThrow()
  })

  it('given groups missing a mutation when asserted then throws', () => {
    // Arrange — input has 2, groups have 1
    const m1 = mutationAt(1)
    const m2 = mutationAt(2)
    const groups = [{ mutations: [m1], testMethods: new Set<string>() }]

    // Act & Assert
    expect(() => assertGroupingInvariants([m1, m2], groups)).toThrow(
      /invariant violated/i
    )
  })

  it('given a duplicated mutation across groups when asserted then throws', () => {
    // Arrange — same mutation appears in two groups; flat length matches but Set size does not
    const m1 = mutationAt(1)
    const m2 = mutationAt(2)
    const groups = [
      { mutations: [m1, m1], testMethods: new Set<string>() },
      { mutations: [m2], testMethods: new Set<string>() },
    ]

    // Act & Assert — flat.length === 3, mutations.length === 2 (length-mismatch branch covers this case)
    expect(() => assertGroupingInvariants([m1, m2], groups)).toThrow(
      /invariant violated/i
    )
  })

  it('given a duplicate that masks itself across same-length groups when asserted then throws', () => {
    // Arrange — flat.length === input.length but unique count differs
    const m1 = mutationAt(1)
    const m2 = mutationAt(2)
    const groups = [{ mutations: [m1, m1], testMethods: new Set<string>() }]

    // Act & Assert — exercises the new-Set-size branch independently
    expect(() => assertGroupingInvariants([m1, m2], groups)).toThrow(
      /invariant violated/i
    )
  })
})
