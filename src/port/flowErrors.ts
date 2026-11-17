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
  constructor(message: string) {
    super(message)
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
    public readonly changedVersions: number[]
  ) {
    super(
      `Flow '${apiName}' was changed outside the run (versions ${changedVersions.join(', ')})`
    )
    this.name = 'FlowChangedOutsideRunError'
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
    public readonly problems: string[]
  ) {
    super(
      `Flow '${apiName}' could not be put back to its original version: ${problems.join('; ')}`
    )
    this.name = 'FlowRevertError'
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
