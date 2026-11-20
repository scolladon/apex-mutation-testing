// The typed rejections of the Flow engine, colocated on the port both the org
// adapter (which throws them) and the command (which renders each one
// through its message bundle) already depend on — the same arrangement as
// apexClassErrors.ts. Org-supplied values travel on fields, never only in
// the super() message, so the command decides how they are displayed.

// The org is neither a sandbox (scratch orgs included) nor a Developer
// Edition org (Trailhead playgrounds included).
export class ProductionOrgError extends Error {
  constructor() {
    super(
      'Flow mutation testing only runs against a sandbox, scratch or Developer Edition org'
    )
    this.name = 'ProductionOrgError'
  }
}

// FlowTests of a namespaced org cannot be run by name: the runner answers
// "Invalid ID or name" to every form the plugin can send.
export class FlowNamespacedOrgError extends Error {
  constructor(public readonly namespacePrefix: string) {
    super(
      `Flow mutation testing does not support an org with a namespace (${namespacePrefix})`
    )
    this.name = 'FlowNamespacedOrgError'
  }
}

export class FlowApiVersionTooLowError extends Error {
  constructor(
    public readonly apiVersion: string,
    public readonly minimumApiVersion: string
  ) {
    super(
      `Flow mutation testing needs API version ${minimumApiVersion} or later (got ${apiVersion})`
    )
    this.name = 'FlowApiVersionTooLowError'
  }
}

export class FlowNotFoundError extends Error {
  constructor(public readonly apiName: string) {
    super(`Flow '${apiName}' not found`)
    this.name = 'FlowNotFoundError'
  }
}

export class FlowAmbiguousError extends Error {
  constructor(
    public readonly apiName: string,
    public readonly count: number
  ) {
    super(`Flow '${apiName}' matches more than one flow definition`)
    this.name = 'FlowAmbiguousError'
  }
}

export class NoFlowTestsError extends Error {
  constructor(public readonly apiName: string) {
    super(`Flow '${apiName}' has no FlowTest`)
    this.name = 'NoFlowTestsError'
  }
}

export class FlowTestNotFoundError extends Error {
  constructor(
    public readonly apiName: string,
    public readonly testNames: string[]
  ) {
    super(`FlowTest(s) not found for Flow '${apiName}'`)
    this.name = 'FlowTestNotFoundError'
  }
}

export class UnsupportedFlowVersionStateError extends Error {
  constructor(
    public readonly apiName: string,
    public readonly status: string
  ) {
    super(`Flow '${apiName}' latest version has an unsupported status`)
    this.name = 'UnsupportedFlowVersionStateError'
  }
}

// The latest version is a Draft while an older version is Active. FlowTests
// only run against the Active version, so testing the Draft would mean
// activating it — after which it can never be a Draft again.
export class FlowDraftBesideActiveError extends Error {
  constructor(
    public readonly apiName: string,
    public readonly draftVersion: number,
    public readonly activeVersion: number
  ) {
    super(
      `Flow '${apiName}' latest version is a Draft beside an Active version`
    )
    this.name = 'FlowDraftBesideActiveError'
  }
}

// Versions carrying TEMPORARY_VERSION_MARKER: an earlier run was interrupted
// before its restore, and left a mutant in the org. Taking it for the
// original would test, and finally restore, the mutant.
export class FlowLeftoverVersionError extends Error {
  constructor(
    public readonly apiName: string,
    public readonly versionNumbers: number[]
  ) {
    super(
      `Flow '${apiName}' has versions left by an interrupted run: ${versionNumbers.join(', ')}`
    )
    this.name = 'FlowLeftoverVersionError'
  }
}

// A FlowTest still carrying the marker an earlier run wrote when it detached
// the test from its flow versions: that run was interrupted before its
// restore, and pinnedVersions are the associations it removed.
export class FlowTestLeftoverError extends Error {
  constructor(
    public readonly apiName: string,
    public readonly testName: string,
    public readonly pinnedVersions: number[]
  ) {
    super(
      `FlowTest '${testName}' of Flow '${apiName}' was left detached by an interrupted run`
    )
    this.name = 'FlowTestLeftoverError'
  }
}

// Requested FlowTests the runner did not report as run, on a run in which
// none failed: their silence would read as a pass. Not a safety error — the
// org is untouched by it — so a mutant's run is a RuntimeError and the
// baseline's stops the run.
export class FlowTestsNotRunError extends Error {
  constructor(
    public readonly apiName: string,
    public readonly missingTests: string[]
  ) {
    super(
      `FlowTests of Flow '${apiName}' did not run: ${missingTests.join(', ')}`
    )
    this.name = 'FlowTestsNotRunError'
  }
}

export class FlowVersionLimitError extends Error {
  constructor(
    public readonly apiName: string,
    public readonly versionCount: number,
    public readonly versionLimit: number
  ) {
    super(`Flow '${apiName}' has no room left for a temporary version`)
    this.name = 'FlowVersionLimitError'
  }
}

// The org refused to save a deployed Flow or FlowTest, or to activate a
// deployed Flow version. Per mutant this is a verdict (not-compilable), never
// thrown past the test bed; during prepare or restore it is a failure of the
// run.
export class FlowDeployFailedError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Deployment failed: ${problems.join('; ')}`)
    this.name = 'FlowDeployFailedError'
  }
}

// The org refused the FlowTests unpinned from their flow versions for the run.
export class FlowTestRepinFailedError extends Error {
  constructor(public readonly problems: string[]) {
    super(`FlowTest deployment failed: ${problems.join('; ')}`)
    this.name = 'FlowTestRepinFailedError'
  }
}

// A check the run makes on the org's own state failed: continuing could leave
// the org in a state the restore does not know how to undo. Unlike a
// transport failure on one mutant — scored RuntimeError, the run goes on —
// every subclass aborts the run and triggers the restore.
export class FlowOrgSafetyError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'FlowOrgSafetyError'
  }
}

// A flow's versions as the guard compares them: their numbers in version
// order, and the one that is Active, if any.
export interface FlowVersionState {
  numbers: number[]
  active: number | undefined
}

export class FlowVersionGuardError extends FlowOrgSafetyError {
  constructor(
    public readonly apiName: string,
    public readonly expected: FlowVersionState,
    public readonly observed: FlowVersionState
  ) {
    super(`Flow '${apiName}' versions changed unexpectedly during the run`)
    this.name = 'FlowVersionGuardError'
  }
}

// The flow's versions differ from those the run last left before it writes
// again: someone saved, added, removed or (de)activated a version meanwhile.
// The run stops without writing, so that change is left in place.
export class FlowChangedOutsideRunError extends FlowOrgSafetyError {
  constructor(
    public readonly apiName: string,
    public readonly changedVersions: number[],
    // True when seen before the run's first write: nothing of the run's own
    // is in the org yet.
    public readonly beforeAnyWrite = false
  ) {
    super(
      `Flow '${apiName}' was changed outside the run (versions ${changedVersions.join(', ')})`
    )
    this.name = 'FlowChangedOutsideRunError'
  }
}

// A Metadata API deploy that ended neither in success nor in a refusal of
// one of its components: it timed out, was cancelled, failed for an org-wide
// reason, or its status could not be read. What it did to the org is
// unknown, so it is never a verdict; `pending` says it may still land, in
// which case the restore waits for it first.
export class FlowDeployNotCompletedError extends FlowOrgSafetyError {
  constructor(
    public readonly asyncProcessId: string | undefined,
    public readonly status: string,
    public readonly pending: boolean,
    public readonly detail: string
  ) {
    super(
      `Metadata API deploy ${asyncProcessId ?? '(not started)'} did not complete (${status}): ${detail}`
    )
    this.name = 'FlowDeployNotCompletedError'
  }
}

// A FlowTest that did not come back free of flow-version associations after
// it was deployed without any (pinnedVersions is empty when it did not come
// back at all): it would be skipped whenever the version under test is not
// one of its versions.
export class FlowTestPinError extends FlowOrgSafetyError {
  constructor(
    public readonly testName: string,
    public readonly pinnedVersions: number[]
  ) {
    super(
      `FlowTest '${testName}' did not come back free of flow-version associations after its deploy`
    )
    this.name = 'FlowTestPinError'
  }
}

// The FlowTest results the org recorded for a run name other versions than
// the one under test (or none at all): the verdict would describe another
// version, so it is never scored.
export class FlowTestVersionError extends FlowOrgSafetyError {
  constructor(
    public readonly apiName: string,
    public readonly expectedVersion: number,
    public readonly executedVersions: number[]
  ) {
    super(
      `The FlowTests of Flow '${apiName}' did not run against version ${expectedVersion}`
    )
    this.name = 'FlowTestVersionError'
  }
}

// After a mutant's test run the original version could not be made Active
// again, or the temporary version could not be removed: the org is not at
// rest, so the run stops and the restore takes over.
export class FlowRevertError extends FlowOrgSafetyError {
  constructor(
    public readonly apiName: string,
    public readonly failures: Error[]
  ) {
    super(
      `Flow '${apiName}' could not be put back to its original version: ${failures.map(f => f.message).join('; ')}`,
      { cause: failures[0] }
    )
    this.name = 'FlowRevertError'
  }
}

// The Active version is not the original nor one the run created (or no
// version is Active): somebody else activated or deactivated the flow, so
// the original is not activated over their change.
export class FlowForeignActiveVersionError extends Error {
  constructor(
    public readonly apiName: string,
    public readonly activeVersion: number | undefined,
    public readonly originalVersion: number
  ) {
    super(
      `Flow '${apiName}' has ${activeVersion === undefined ? 'no Active version' : `version ${activeVersion} Active`}, which this run did not set: version ${originalVersion} is not activated again`
    )
    this.name = 'FlowForeignActiveVersionError'
  }
}

// A version the run created is Active: it is never deleted, since the
// platform refuses it and the flow would be left without its Active version.
export class FlowActiveVersionNotDeletedError extends Error {
  constructor(public readonly versionNumber: number) {
    super(`Version ${versionNumber} is Active and is not deleted`)
    this.name = 'FlowActiveVersionNotDeletedError'
  }
}

// FlowTests that no longer hold what the run left in them, or were deleted:
// somebody else changed them, so the restore does not write their original
// over that change (nor recreate a deleted one).
export class FlowTestChangedOutsideRunError extends Error {
  constructor(
    public readonly testNames: string[],
    // True when seen before the run's first write.
    public readonly beforeAnyWrite = false
  ) {
    super(`FlowTests changed outside the run: ${testNames.join(', ')}`)
    this.name = 'FlowTestChangedOutsideRunError'
  }
}

// A FlowTest deployed back with its original associations, read back with
// other ones.
// How a FlowTest deployed back failed to come back as it was: with other
// versions, still carrying the run's marker, or not at all.
export type FlowTestRestoreProblem = 'pins' | 'marked' | 'missing'

const RESTORE_PROBLEM_TEXT: Record<FlowTestRestoreProblem, string> = {
  pins: 'came back associated with versions',
  marked: 'came back still marked, associated with versions',
  missing: 'did not come back, expected with versions',
}

export class FlowTestRestorePinError extends Error {
  constructor(
    public readonly testName: string,
    public readonly expectedVersions: number[],
    public readonly foundVersions: number[],
    public readonly problem: FlowTestRestoreProblem = 'pins'
  ) {
    super(
      problem === 'missing'
        ? `FlowTest '${testName}' ${RESTORE_PROBLEM_TEXT.missing} [${expectedVersions.join(', ')}]`
        : `FlowTest '${testName}' ${RESTORE_PROBLEM_TEXT[problem]} [${foundVersions.join(', ')}] instead of [${expectedVersions.join(', ')}]`
    )
    this.name = 'FlowTestRestorePinError'
  }
}

// Raised by restore() once every restore step has been attempted: one failed
// step never stops the others from running, and every failure is kept.
export class FlowRestoreError extends Error {
  constructor(
    public readonly apiName: string,
    public readonly failures: Error[]
  ) {
    super(
      `Flow '${apiName}' could not be fully restored: ${failures.map(f => f.message).join('; ')}`,
      { cause: failures[0] }
    )
    this.name = 'FlowRestoreError'
  }
}

// Several mutants in a row failed on transport after a passing baseline: the
// session expired, a FlowTest was deleted, or the org stopped answering.
// Going on would only add RuntimeErrors, so the run stops and restores.
export class FlowRuntimeErrorStreakError extends Error {
  constructor(
    public readonly apiName: string,
    public readonly count: number,
    public readonly lastReason: string
  ) {
    super(
      `${count} mutants of Flow '${apiName}' in a row failed to run: ${lastReason}`
    )
    this.name = 'FlowRuntimeErrorStreakError'
  }
}

// A run that failed, followed by a restore that failed too. Both are kept,
// typed, so each is rendered as itself; the run failure leads.
export class FlowRunAndRestoreError extends Error {
  constructor(
    public readonly runError: unknown,
    public readonly restoreError: unknown
  ) {
    const text = (value: unknown) =>
      value instanceof Error ? value.message : String(value)
    super(`${text(runError)}\n${text(restoreError)}`, { cause: runError })
    this.name = 'FlowRunAndRestoreError'
  }
}
