import {
  FlowAmbiguousError,
  FlowApiVersionTooLowError,
  FlowDeployFailedError,
  FlowDraftBesideActiveError,
  FlowNotFoundError,
  FlowOrgSafetyError,
  FlowRestoreError,
  FlowRevertError,
  FlowTestNotFoundError,
  FlowTestPinError,
  FlowTestRepinFailedError,
  FlowTestVersionError,
  FlowVersionGuardError,
  FlowVersionLimitError,
  NoFlowTestsError,
  ProductionOrgError,
  UnsupportedFlowVersionStateError,
} from '../../../src/port/flowErrors.js'

describe('flowErrors', () => {
  it.each<[Error, string, string]>([
    [
      new ProductionOrgError(),
      'ProductionOrgError',
      'Flow mutation testing refuses to run against a non-sandbox org',
    ],
    [
      new FlowApiVersionTooLowError('65.0', '66.0'),
      'FlowApiVersionTooLowError',
      'Flow mutation testing needs API version 66.0 or later (got 65.0)',
    ],
    [new FlowNotFoundError('F'), 'FlowNotFoundError', "Flow 'F' not found"],
    [
      new FlowAmbiguousError('F', 2),
      'FlowAmbiguousError',
      "Flow 'F' matches more than one flow definition",
    ],
    [new NoFlowTestsError('F'), 'NoFlowTestsError', "Flow 'F' has no FlowTest"],
    [
      new FlowTestNotFoundError('F', ['T']),
      'FlowTestNotFoundError',
      "FlowTest(s) not found for Flow 'F'",
    ],
    [
      new UnsupportedFlowVersionStateError('F', 'Obsolete'),
      'UnsupportedFlowVersionStateError',
      "Flow 'F' latest version has an unsupported status",
    ],
    [
      new FlowDraftBesideActiveError('F', 3, 2),
      'FlowDraftBesideActiveError',
      "Flow 'F' latest version is a Draft beside an Active version",
    ],
    [
      new FlowVersionLimitError('F', 50, 50),
      'FlowVersionLimitError',
      "Flow 'F' has no room left for a temporary version",
    ],
    [
      new FlowDeployFailedError(['a', 'b']),
      'FlowDeployFailedError',
      'Deployment failed: a; b',
    ],
    [
      new FlowTestRepinFailedError(['a', 'b']),
      'FlowTestRepinFailedError',
      'FlowTest deployment failed: a; b',
    ],
    [new FlowOrgSafetyError('m'), 'FlowOrgSafetyError', 'm'],
    [
      new FlowVersionGuardError(
        'F',
        { numbers: [1], active: 1 },
        { numbers: [1, 2], active: 2 }
      ),
      'FlowVersionGuardError',
      "Flow 'F' versions changed unexpectedly during the run",
    ],
    [
      new FlowTestPinError('T', [2]),
      'FlowTestPinError',
      "FlowTest 'T' did not come back free of flow-version associations after its deploy",
    ],
    [
      new FlowTestVersionError('F', 2, [1]),
      'FlowTestVersionError',
      "The FlowTests of Flow 'F' did not run against version 2",
    ],
    [
      new FlowRevertError('F', ['a', 'b']),
      'FlowRevertError',
      "Flow 'F' could not be put back to its original version: a; b",
    ],
  ])(
    'Given %s, When raised, Then it carries its own name and message',
    (error, name, message) => {
      // Assert
      expect(error.name).toBe(name)
      expect(error.message).toBe(message)
    }
  )

  it.each([
    new FlowVersionGuardError(
      'F',
      { numbers: [], active: undefined },
      { numbers: [], active: undefined }
    ),
    new FlowTestPinError('T', []),
    new FlowTestVersionError('F', 1, []),
    new FlowRevertError('F', []),
  ])(
    'Given %s, When raised, Then it is an org safety error that aborts the run',
    error => {
      // Assert
      expect(error).toBeInstanceOf(FlowOrgSafetyError)
    }
  )

  it('Given a refusal before any write, When raised, Then it is not an org safety error', () => {
    // Assert
    expect(new FlowDraftBesideActiveError('F', 2, 1)).not.toBeInstanceOf(
      FlowOrgSafetyError
    )
  })

  it('Given several restore failures, When raised, Then every message is listed and the first is the cause', () => {
    // Arrange
    const first = new Error('one')

    // Act
    const sut = new FlowRestoreError('F', [first, new Error('two')])

    // Assert
    expect(sut.name).toBe('FlowRestoreError')
    expect(sut.message).toBe("Flow 'F' could not be fully restored: one; two")
    expect(sut.cause).toBe(first)
  })
})
