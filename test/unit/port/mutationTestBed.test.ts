import {
  CompilationCheckFailedError,
  RUN_TESTS,
  SKIP_TESTS,
} from '../../../src/port/mutationTestBed.js'

describe('CompilationCheckFailedError', () => {
  it('Given an underlying deploy error, When constructed, Then it carries the reason, the reason message and the reason as cause', () => {
    // Arrange
    const reason = new Error('Deployment failed:\n[classes/X.cls:1:1] boom')

    // Act
    const sut = new CompilationCheckFailedError(reason)

    // Assert
    expect(sut.reason).toBe(reason)
    expect(sut.message).toBe(reason.message)
    expect(sut.cause).toBe(reason)
    expect(sut.name).toBe('CompilationCheckFailedError')
    expect(sut).toBeInstanceOf(Error)
  })
})

describe('RestorePolicy constants', () => {
  it('Given the two policy constants, When compared, Then they are distinct', () => {
    // Assert
    expect(RUN_TESTS).not.toBe(SKIP_TESTS)
  })
})
