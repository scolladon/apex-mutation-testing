import {
  FlowDeployFailedError,
  FlowDraftBesideActiveError,
  FlowRestoreError,
  FlowRevertError,
  FlowTestPinError,
  FlowTestRepinFailedError,
  FlowTestVersionError,
  FlowVersionGuardError,
  FlowVersionLimitError,
  type FlowVersionState,
  UnsupportedFlowVersionStateError,
} from '../../port/flowErrors.js'
import type {
  FlowSource,
  FlowTestSource,
} from '../../port/flowSourceProvider.js'
import type {
  FlowBaseline,
  FlowMutantVerdict,
  FlowPrepareHooks,
  FlowTestBed,
} from '../../port/flowTestBed.js'
import type { ApexTestRunner } from './apexTestRunner.js'
import type { FlowMetadataRepository } from './flowMetadataRepository.js'
import {
  type FlowTestResultRepository,
  versionsRunBetween,
} from './flowTestResultRepository.js'
import {
  pinnedVersions,
  toDraftXml,
  unpinFlowTest,
} from './flowVersionEdits.js'
import type {
  FlowVersionRepository,
  FlowVersionRow,
} from './flowVersionRepository.js'

// Salesforce caps every flow at 50 versions, in every edition.
export const FLOW_VERSION_LIMIT = 50

const ACTIVE = 'Active'
const DRAFT = 'Draft'
const PASS = 'Pass'

// The test runner runs a FlowTest against one version only: the Active one,
// or the latest when none is Active. So the version under test must be that
// version while its tests run:
//  - 'activate': the latest version is Active. Each evaluation deploys the
//    XML as a temporary Draft beside it, activates that Draft for the test
//    run, then activates the original again and deletes the temporary
//    version. Between two evaluations the org holds exactly its snapshot.
//  - 'overwrite': no version is Active and the latest is a Draft. Every
//    deploy overwrites that Draft in place, and the restore deploys its
//    original content back. No version is created.
type Mode = 'activate' | 'overwrite'

interface Session {
  source: FlowSource
  definitionId: string
  snapshot: FlowVersionRow[]
  mode: Mode
  // 'overwrite' only: set once the first deploy is attempted, from when the
  // restore must deploy the original back, whether or not it succeeded.
  flowTouched: boolean
  // Originals of the FlowTests this run unpinned, recorded before their
  // deploy is attempted so the restore covers a deploy that half-failed.
  unpinned: FlowTestSource[]
}

const numbersOf = (versions: FlowVersionRow[]): number[] =>
  versions.map(version => version.versionNumber)

const activeOf = (versions: FlowVersionRow[]): number | undefined =>
  versions.find(version => version.status === ACTIVE)?.versionNumber

const stateOf = (versions: FlowVersionRow[]): FlowVersionState => ({
  numbers: numbersOf(versions),
  active: activeOf(versions),
})

const sameState = (a: FlowVersionState, b: FlowVersionState): boolean =>
  a.active === b.active &&
  a.numbers.length === b.numbers.length &&
  a.numbers.every((number, index) => number === b.numbers[index])

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value))

export class OrgFlowTestBed implements FlowTestBed {
  private session: Session | undefined

  constructor(
    private readonly metadata: FlowMetadataRepository,
    private readonly versions: FlowVersionRepository,
    private readonly results: FlowTestResultRepository,
    private readonly runner: ApexTestRunner
  ) {}

  public async prepare(
    source: FlowSource,
    hooks: FlowPrepareHooks
  ): Promise<FlowBaseline> {
    hooks.onPreparing()
    const definitionId = await this.versions.readDefinitionId(source.apiName)
    const snapshot = await this.versions.listVersions(definitionId)
    const session: Session = {
      source,
      definitionId,
      snapshot,
      mode: this.selectMode(source.apiName, snapshot),
      flowTouched: false,
      unpinned: [],
    }
    this.session = session
    await this.unpinFlowTests(session)
    hooks.onPrepared()

    // The baseline goes through exactly the path every mutant takes, so the
    // whole cycle — deploy, activation, version check, revert — is proven
    // once on the original before any mutant relies on it.
    hooks.onBaselineStarting()
    const started = performance.now()
    const { failingTests, runMs } = await this.runVersion(session, source.xml)
    return {
      testsRan: source.tests.length,
      failingTests,
      cost: { applyMs: performance.now() - started - runMs, runMs },
    }
  }

  public async evaluate(mutatedXml: string): Promise<FlowMutantVerdict> {
    const session = this.requireSession()
    try {
      const { failingTests } = await this.runVersion(session, mutatedXml)
      return { kind: 'executed', failingTests }
    } catch (error: unknown) {
      if (error instanceof FlowDeployFailedError) {
        return { kind: 'not-compilable', detail: error.message }
      }
      throw error
    }
  }

  // Every step is attempted whatever the outcome of the one before, and the
  // org is then checked against the snapshot taken before the run: the
  // restore only reports success once the versions are exactly those the run
  // started from, with the same one Active.
  public async restore(): Promise<void> {
    const session = this.session
    if (!session) return
    const failures: Error[] = []
    const attempt = async (step: () => Promise<void>) => {
      try {
        await step()
      } catch (error: unknown) {
        failures.push(toError(error))
      }
    }

    if (session.unpinned.length > 0) {
      await attempt(() =>
        this.metadata.deploy(
          session.unpinned.map(test => ({
            type: 'FlowTest' as const,
            fullName: test.fullName,
            xml: test.xml,
          }))
        )
      )
    }
    if (session.flowTouched) {
      await attempt(() => this.deployFlow(session, session.source.xml))
    }
    // Stryker disable next-line ConditionalExpression: in 'overwrite' mode no
    // version is Active in the snapshot or the org, so reactivateOriginal
    // compares undefined with undefined and activates nothing either way.
    if (session.mode === 'activate') {
      await attempt(() => this.reactivateOriginal(session))
    }
    await attempt(() => this.deleteVersionsOutsideSnapshot(session))
    await attempt(() => this.assertAtRest(session))

    if (failures.length > 0) {
      throw new FlowRestoreError(session.source.apiName, failures)
    }
    this.session = undefined
  }

  private selectMode(apiName: string, snapshot: FlowVersionRow[]): Mode {
    const latest = snapshot.at(-1)
    const active = activeOf(snapshot)
    if (latest?.status === ACTIVE) {
      if (snapshot.length >= FLOW_VERSION_LIMIT) {
        throw new FlowVersionLimitError(
          apiName,
          snapshot.length,
          FLOW_VERSION_LIMIT
        )
      }
      return 'activate'
    }
    if (latest?.status === DRAFT) {
      if (active !== undefined) {
        throw new FlowDraftBesideActiveError(
          apiName,
          latest.versionNumber,
          active
        )
      }
      return 'overwrite'
    }
    throw new UnsupportedFlowVersionStateError(
      apiName,
      latest?.status ?? 'none'
    )
  }

  // Deploys `xml` as the version under test, runs the FlowTests against it,
  // and leaves the org at rest again. A refused deploy or activation is a
  // FlowDeployFailedError, thrown once the org is known to be at rest.
  private runVersion(
    session: Session,
    xml: string
  ): Promise<{ failingTests: string[]; runMs: number }> {
    return session.mode === 'activate'
      ? this.runTemporaryVersion(session, xml)
      : this.runOverwrittenDraft(session, xml)
  }

  // Whatever the deploy's outcome, the versions must be the snapshot's: only
  // then is a refusal a verdict about the XML.
  private async runOverwrittenDraft(
    session: Session,
    xml: string
  ): Promise<{ failingTests: string[]; runMs: number }> {
    session.flowTouched = true
    let deployError: unknown
    try {
      await this.deployFlow(session, xml)
    } catch (error: unknown) {
      deployError = error
    }
    await this.assertAtRest(session)
    if (deployError !== undefined) {
      throw deployError
    }
    return this.runFlowTests(
      session,
      (session.snapshot.at(-1) as FlowVersionRow).versionNumber
    )
  }

  // The revert runs whatever happened before it — a refused deploy, a
  // refused activation, a failed test run — so the org is back at its
  // snapshot before any outcome, verdict or error, leaves this method.
  private async runTemporaryVersion(
    session: Session,
    xml: string
  ): Promise<{ failingTests: string[]; runMs: number }> {
    let outcome: { failingTests: string[]; runMs: number } | undefined
    let runError: unknown
    try {
      await this.deployFlow(session, xml)
      const temporary = await this.resolveTemporaryVersion(session)
      await this.versions.activateVersion(session.definitionId, temporary)
      await this.assertState(session, {
        numbers: [...numbersOf(session.snapshot), temporary].sort(
          (a, b) => a - b
        ),
        active: temporary,
      })
      outcome = await this.runFlowTests(session, temporary)
    } catch (error: unknown) {
      runError = error
    }
    await this.revertTemporaryVersion(session, runError)
    if (outcome === undefined) {
      throw runError
    }
    return outcome
  }

  private async deployFlow(session: Session, xml: string): Promise<void> {
    await this.metadata.deploy([
      {
        type: 'Flow',
        fullName: session.source.apiName,
        xml: toDraftXml(xml, session.mode === 'activate'),
      },
    ])
  }

  // Exactly one Draft must have appeared beside the snapshot, with the
  // original still Active: it is the temporary version.
  private async resolveTemporaryVersion(session: Session): Promise<number> {
    const observed = await this.readVersions(session)
    const known = new Set(numbersOf(session.snapshot))
    const created = observed.filter(
      version => !known.has(version.versionNumber)
    )
    if (
      created.length !== 1 ||
      created[0].status !== DRAFT ||
      activeOf(observed) !== activeOf(session.snapshot)
    ) {
      throw new FlowVersionGuardError(
        session.source.apiName,
        stateOf(session.snapshot),
        stateOf(observed)
      )
    }
    return created[0].versionNumber
  }

  // Puts the original back as the Active version and removes the temporary
  // one. Any failure leaves the org away from its snapshot, which is never a
  // verdict: it aborts the run, keeping the test run's own failure as well.
  private async revertTemporaryVersion(
    session: Session,
    runError: unknown
  ): Promise<void> {
    try {
      await this.reactivateOriginal(session)
      await this.deleteVersionsOutsideSnapshot(session)
      await this.assertAtRest(session)
    } catch (revertError: unknown) {
      const problems = [toError(revertError).message]
      if (runError !== undefined) {
        problems.push(toError(runError).message)
      }
      throw new FlowRevertError(session.source.apiName, problems)
    }
  }

  private async reactivateOriginal(session: Session): Promise<void> {
    const original = activeOf(session.snapshot) as number
    if (activeOf(await this.readVersions(session)) !== original) {
      await this.versions.activateVersion(session.definitionId, original)
    }
  }

  // Each FlowTest loses its version associations for the run, is deployed,
  // then read back: a FlowTest still associated with versions would be
  // skipped whenever the version under test is not one of them.
  private async unpinFlowTests(session: Session): Promise<void> {
    const unpinned = session.source.tests
      .map(test => ({ test, xml: unpinFlowTest(test.xml) }))
      .filter(({ test, xml }) => xml !== test.xml)
    if (unpinned.length === 0) return

    session.unpinned = unpinned.map(({ test }) => test)
    try {
      await this.metadata.deploy(
        unpinned.map(({ test, xml }) => ({
          type: 'FlowTest' as const,
          fullName: test.fullName,
          xml,
        }))
      )
    } catch (error: unknown) {
      throw error instanceof FlowDeployFailedError
        ? new FlowTestRepinFailedError(error.problems)
        : error
    }
    const readBack = await this.metadata.retrieve([
      {
        type: 'FlowTest',
        fullNames: unpinned.map(({ test }) => test.fullName),
      },
    ])
    for (const { test } of unpinned) {
      const file = readBack.find(entry => entry.fullName === test.fullName)
      if (!file) {
        throw new FlowTestPinError(test.fullName, [])
      }
      const pins = pinnedVersions(file.xml)
      if (pins.length > 0) {
        throw new FlowTestPinError(test.fullName, pins)
      }
    }
  }

  // The names of the FlowTests that failed. A run that executed none of them
  // is not evidence about the version, so it is an error, never "survived";
  // and the results the org recorded must name the version under test, and
  // only it — the runner itself never says which version it ran.
  private async runFlowTests(
    session: Session,
    expectedVersion: number
  ): Promise<{ failingTests: string[]; runMs: number }> {
    const before = await this.results.listResults(session.definitionId)
    const started = performance.now()
    const result = await this.runner.runFlowTests(
      session.source.apiName,
      session.source.tests.map(test => test.fullName)
    )
    const runMs = performance.now() - started
    if (result.tests.length === 0) {
      throw new Error(
        `No FlowTest of '${session.source.apiName}' ran (outcome: ${result.outcome})`
      )
    }
    const executed = versionsRunBetween(
      before,
      await this.results.listResults(session.definitionId)
    )
    if (
      executed.length === 0 ||
      executed.some(version => version !== expectedVersion)
    ) {
      throw new FlowTestVersionError(
        session.source.apiName,
        expectedVersion,
        executed
      )
    }
    return {
      failingTests: result.tests
        .filter(test => test.outcome !== PASS)
        .map(test => test.methodName),
      runMs,
    }
  }

  private async deleteVersionsOutsideSnapshot(session: Session): Promise<void> {
    const known = new Set(numbersOf(session.snapshot))
    const extra = (await this.readVersions(session)).filter(
      version => !known.has(version.versionNumber)
    )
    for (const version of extra) {
      if (version.status === ACTIVE) {
        throw new Error(
          `Version ${version.versionNumber} is Active and is not deleted`
        )
      }
      await this.versions.deleteVersion(version)
    }
  }

  private assertAtRest(session: Session): Promise<void> {
    return this.assertState(session, stateOf(session.snapshot))
  }

  private async assertState(
    session: Session,
    expected: FlowVersionState
  ): Promise<void> {
    const observed = stateOf(await this.readVersions(session))
    if (!sameState(observed, expected)) {
      throw new FlowVersionGuardError(
        session.source.apiName,
        expected,
        observed
      )
    }
  }

  private readVersions(session: Session): Promise<FlowVersionRow[]> {
    return this.versions.listVersions(session.definitionId)
  }

  private requireSession(): Session {
    if (!this.session) {
      throw new Error('prepare() must be called before evaluate()')
    }
    return this.session
  }
}
