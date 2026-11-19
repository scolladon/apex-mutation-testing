import {
  FlowActiveVersionNotDeletedError,
  FlowAmbiguousError,
  FlowApiVersionTooLowError,
  FlowChangedOutsideRunError,
  FlowDeployFailedError,
  FlowDeployNotCompletedError,
  FlowDraftBesideActiveError,
  FlowForeignActiveVersionError,
  FlowLeftoverVersionError,
  FlowNamespacedOrgError,
  FlowNotFoundError,
  FlowOrgSafetyError,
  FlowRestoreError,
  FlowRevertError,
  FlowRunAndRestoreError,
  FlowRuntimeErrorStreakError,
  FlowTestChangedOutsideRunError,
  FlowTestLeftoverError,
  FlowTestNotFoundError,
  FlowTestPinError,
  FlowTestRepinFailedError,
  FlowTestRestorePinError,
  FlowTestsNotRunError,
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
      'Flow mutation testing only runs against a sandbox, scratch or Developer Edition org',
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
      new FlowLeftoverVersionError('F', [2, 3]),
      'FlowLeftoverVersionError',
      "Flow 'F' has versions left by an interrupted run: 2, 3",
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
      new FlowChangedOutsideRunError('F', [1, 2]),
      'FlowChangedOutsideRunError',
      "Flow 'F' was changed outside the run (versions 1, 2)",
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
      new FlowRevertError('F', [new Error('a'), new Error('b')]),
      'FlowRevertError',
      "Flow 'F' could not be put back to its original version: a; b",
    ],
    [
      new FlowNamespacedOrgError('ns'),
      'FlowNamespacedOrgError',
      'Flow mutation testing does not support an org with a namespace (ns)',
    ],
    [
      new FlowTestLeftoverError('F', 'T', [1, 2]),
      'FlowTestLeftoverError',
      "FlowTest 'T' of Flow 'F' was left detached by an interrupted run",
    ],
    [
      new FlowTestsNotRunError('F', ['A', 'B']),
      'FlowTestsNotRunError',
      "FlowTests of Flow 'F' did not run: A, B",
    ],
    [
      new FlowDeployNotCompletedError('0Af1', 'Canceled', false, 'canceled'),
      'FlowDeployNotCompletedError',
      'Metadata API deploy 0Af1 did not complete (Canceled): canceled',
    ],
    [
      new FlowDeployNotCompletedError(undefined, 'Unknown', false, 'down'),
      'FlowDeployNotCompletedError',
      'Metadata API deploy (not started) did not complete (Unknown): down',
    ],
    [
      new FlowForeignActiveVersionError('F', 3, 1),
      'FlowForeignActiveVersionError',
      "Flow 'F' has version 3 Active, which this run did not set: version 1 is not activated again",
    ],
    [
      new FlowForeignActiveVersionError('F', undefined, 1),
      'FlowForeignActiveVersionError',
      "Flow 'F' has no Active version, which this run did not set: version 1 is not activated again",
    ],
    [
      new FlowActiveVersionNotDeletedError(2),
      'FlowActiveVersionNotDeletedError',
      'Version 2 is Active and is not deleted',
    ],
    [
      new FlowTestChangedOutsideRunError(['A', 'B']),
      'FlowTestChangedOutsideRunError',
      'FlowTests changed outside the run: A, B',
    ],
    [
      new FlowTestRestorePinError('T', [1, 2], [1, 3]),
      'FlowTestRestorePinError',
      "FlowTest 'T' came back associated with versions [1, 3] instead of [1, 2]",
    ],
    [
      new FlowRuntimeErrorStreakError('F', 3, 'INVALID_SESSION_ID'),
      'FlowRuntimeErrorStreakError',
      "3 mutants of Flow 'F' in a row failed to run: INVALID_SESSION_ID",
    ],
    [
      new FlowRunAndRestoreError(new Error('run'), 'restore'),
      'FlowRunAndRestoreError',
      'run\nrestore',
    ],
    [
      new FlowRunAndRestoreError('run', new Error('restore')),
      'FlowRunAndRestoreError',
      'run\nrestore',
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
    new FlowChangedOutsideRunError('F', []),
    new FlowTestPinError('T', []),
    new FlowTestVersionError('F', 1, []),
    new FlowRevertError('F', []),
    new FlowDeployNotCompletedError('0Af1', 'InProgress', true, 'x'),
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
    expect(new FlowLeftoverVersionError('F', [2])).not.toBeInstanceOf(
      FlowOrgSafetyError
    )
    for (const refusal of [
      new FlowNamespacedOrgError('ns'),
      new FlowTestLeftoverError('F', 'T', [1]),
      new FlowTestsNotRunError('F', ['T']),
      new FlowForeignActiveVersionError('F', 2, 1),
      new FlowActiveVersionNotDeletedError(2),
      new FlowTestChangedOutsideRunError(['T']),
      new FlowTestRestorePinError('T', [1], []),
      new FlowRuntimeErrorStreakError('F', 3, 'x'),
      new FlowRunAndRestoreError('a', 'b'),
    ]) {
      expect(refusal).not.toBeInstanceOf(FlowOrgSafetyError)
    }
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

  it('Given a revert with failures, When raised, Then the first failure is the cause and every one is kept', () => {
    // Arrange
    const first = new Error('one')

    // Act
    const sut = new FlowRevertError('F', [first, new Error('two')])

    // Assert
    expect(sut.cause).toBe(first)
    expect(sut.failures.map(f => f.message)).toEqual(['one', 'two'])
  })

  it('Given a run failure followed by a restore failure, When raised, Then both are kept typed and the run failure is the cause', () => {
    // Arrange
    const run = new FlowLeftoverVersionError('F', [2])
    const restore = new FlowRestoreError('F', [new Error('x')])

    // Act
    const sut = new FlowRunAndRestoreError(run, restore)

    // Assert
    expect(sut.runError).toBe(run)
    expect(sut.restoreError).toBe(restore)
    expect(sut.cause).toBe(run)
  })

  it('Given a deploy that may still land, When raised, Then it says so and keeps its id', () => {
    // Act
    const sut = new FlowDeployNotCompletedError('0Af1', 'InProgress', true, 'x')

    // Assert
    expect(sut).toMatchObject({
      asyncProcessId: '0Af1',
      status: 'InProgress',
      pending: true,
      detail: 'x',
    })
  })
})
