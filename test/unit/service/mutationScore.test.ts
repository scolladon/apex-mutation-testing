import {
  APEX_SCORE_POLICY,
  calculateMutationScore,
  FLOW_SCORE_POLICY,
} from '../../../src/service/mutationScore.js'

describe('calculateMutationScore', () => {
  it('Given 2 killed and 1 survived, When scored, Then the score is the unrounded percentage under either policy', () => {
    // Arrange
    const statuses = ['Killed', 'Killed', 'Survived']

    // Act & Assert
    expect(calculateMutationScore(statuses, APEX_SCORE_POLICY)).toBe(
      (2 / 3) * 100
    )
    expect(calculateMutationScore(statuses, FLOW_SCORE_POLICY)).toBe(
      (2 / 3) * 100
    )
  })

  it('Given a RuntimeError, When scored, Then Apex counts it detected and Flow leaves it out', () => {
    // Arrange
    const statuses = ['RuntimeError', 'Survived']

    // Act & Assert
    expect(calculateMutationScore(statuses, APEX_SCORE_POLICY)).toBe(50)
    expect(calculateMutationScore(statuses, FLOW_SCORE_POLICY)).toBe(0)
  })

  it('Given a RuntimeError beside a kill, When scored for a Flow, Then only the kill is scored', () => {
    // Act & Assert
    expect(
      calculateMutationScore(['RuntimeError', 'Killed'], FLOW_SCORE_POLICY)
    ).toBe(100)
  })

  it('Given only excluded statuses, When scored, Then the score is 0', () => {
    // Act & Assert
    expect(
      calculateMutationScore(
        ['CompileError', 'RuntimeError'],
        FLOW_SCORE_POLICY
      )
    ).toBe(0)
    expect(calculateMutationScore([], APEX_SCORE_POLICY)).toBe(0)
  })

  it('Given a CompileError, When scored, Then it leaves the denominator under either policy', () => {
    // Arrange
    const statuses = ['Killed', 'CompileError']

    // Act & Assert
    expect(calculateMutationScore(statuses, APEX_SCORE_POLICY)).toBe(100)
    expect(calculateMutationScore(statuses, FLOW_SCORE_POLICY)).toBe(100)
  })
})
