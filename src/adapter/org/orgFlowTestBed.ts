import {
  FlowChangedOutsideRunError,
  FlowDeployFailedError,
  FlowDraftBesideActiveError,
  FlowLeftoverVersionError,
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
  TEMPORARY_VERSION_MARKER,
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
// Every XML an evaluation deploys carries TEMPORARY_VERSION_MARKER, so a run
// interrupted before its restore leaves a version the next run recognizes.
type Mode = 'activate' | 'overwrite'

interface Session {
  source: FlowSource
  definitionId: string
  snapshot: FlowVersionRow[]
  mode: Mode
  // The versions as the run last left them, record Ids included: the
  // snapshot, except that a deploy over the Draft ('overwrite') gives it a
  // new Id. Checked before every write; any other difference is somebody
  // else's change, which the run never writes over.
  expected: FlowVersionRow[]
  // Record Ids of the versions this run's deploys created. Only these are
  // ever deleted, or have the original activated over them. A version number
  // would not do: a deleted version's number is given to the next version
  // created, whoever creates it.
  created: Set<string>
  // 'overwrite' only: set once the first deploy is attempted, from when the
  // restore must deploy the original back, whether or not it succeeded.
  flowTouched: boolean
  // Originals of the FlowTests this run unpinned, recorded before their
  // deploy is attempted so the restore covers a deploy that half-failed.
  unpinned: FlowTestSource[]
}

type RunOutcome = { failingTests: string[]; runMs: number }

const numbersOf = (versions: FlowVersionRow[]): number[] =>
  versions.map(version => version.versionNumber)

const activeRowOf = (versions: FlowVersionRow[]): FlowVersionRow | undefined =>
  versions.find(version => version.status === ACTIVE)

const activeOf = (versions: FlowVersionRow[]): number | undefined =>
  activeRowOf(versions)?.versionNumber

const stateOf = (versions: FlowVersionRow[]): FlowVersionState => ({
  numbers: numbersOf(versions),
  active: activeOf(versions),
})

const sameState = (a: FlowVersionState, b: FlowVersionState): boolean =>
  a.active === b.active &&
  a.numbers.length === b.numbers.length &&
  a.numbers.every((number, index) => number === b.numbers[index])

// The version numbers whose record Id or status differs between the two
// listings, a version present in only one of them included.
const changedVersions = (
  expected: FlowVersionRow[],
  observed: FlowVersionRow[]
): number[] => {
  const keyed = (versions: FlowVersionRow[]) =>
    new Map(
      versions.map(version => [
        version.versionNumber,
        `${version.id}|${version.status}`,
      ])
    )
  const before = keyed(expected)
  const after = keyed(observed)
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter(number => before.get(number) !== after.get(number))
    .sort((a, b) => a - b)
}

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
    this.assertNoLeftover(source.apiName, snapshot)
    const session: Session = {
      source,
      definitionId,
      snapshot,
      mode: this.selectMode(source.apiName, snapshot),
      expected: snapshot,
      created: new Set(),
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
  // started from, with the same one Active. It only ever undoes what the run
  // did: a version somebody else saved or activated meanwhile is left as it
  // is, and the restore then fails, naming the difference.
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
    if (session.mode === 'activate') {
      await attempt(() => this.reactivateOriginal(session))
    }
    await attempt(() => this.deleteCreatedVersions(session))
    if (session.flowTouched) {
      await attempt(() => this.restoreDraft(session))
    }
    await attempt(() => this.assertAtRest(session))

    if (failures.length > 0) {
      throw new FlowRestoreError(session.source.apiName, failures)
    }
    this.session = undefined
  }

  // A marked version is a mutant an interrupted run left behind: taken for
  // the original, it would be the source of every mutant and what the
  // restore puts back.
  private assertNoLeftover(apiName: string, snapshot: FlowVersionRow[]): void {
    const leftovers = snapshot.filter(version =>
      version.description.includes(TEMPORARY_VERSION_MARKER)
    )
    if (leftovers.length > 0) {
      throw new FlowLeftoverVersionError(apiName, numbersOf(leftovers))
    }
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
  private runVersion(session: Session, xml: string): Promise<RunOutcome> {
    return session.mode === 'activate'
      ? this.runTemporaryVersion(session, xml)
      : this.runOverwrittenDraft(session, xml)
  }

  // Whatever the deploy's outcome, the versions must be the snapshot's: only
  // then is a refusal a verdict about the XML.
  private async runOverwrittenDraft(
    session: Session,
    xml: string
  ): Promise<RunOutcome> {
    await this.assertUntouched(session)
    session.flowTouched = true
    const { observed, deployError } = await this.deployObserved(session, xml)
    this.checkState(session, stateOf(session.snapshot), observed)
    if (deployError !== undefined) {
      throw deployError
    }
    return this.runFlowTests(
      session,
      (session.snapshot.at(-1) as FlowVersionRow).versionNumber
    )
  }

  // The revert runs whatever happened after the deploy — a refused deploy, a
  // refused activation, a failed test run — so the org is back at its
  // snapshot before any outcome, verdict or error, leaves this method.
  private async runTemporaryVersion(
    session: Session,
    xml: string
  ): Promise<RunOutcome> {
    await this.assertUntouched(session)
    let outcome: RunOutcome | undefined
    let runError: unknown
    try {
      const { observed, deployError } = await this.deployObserved(session, xml)
      if (deployError !== undefined) {
        throw deployError
      }
      const temporary = this.resolveTemporaryVersion(session, observed)
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

  // Deploys `xml`, marked, then reads the versions back whatever the deploy's
  // outcome. The org was at `expected` right before the deploy, so whatever
  // differs now is the deploy's doing: a version with a new number was
  // created by it, and the Draft it saved over ('overwrite') has a new Id.
  private async deployObserved(
    session: Session,
    xml: string
  ): Promise<{ observed: FlowVersionRow[]; deployError: unknown }> {
    let deployError: unknown
    try {
      await this.deployFlow(session, xml, true)
    } catch (error: unknown) {
      deployError = error
    }
    const observed = await this.readVersions(session)
    const known = new Set(numbersOf(session.expected))
    for (const version of observed) {
      if (!known.has(version.versionNumber)) {
        session.created.add(version.id)
      }
    }
    // Stryker disable next-line ConditionalExpression: in 'activate' mode the
    // snapshot's latest version is the Active original, which no deploy of
    // the run saves over, so its Id would be "updated" to the one it has.
    if (session.mode === 'overwrite') {
      const draftNumber = (session.snapshot.at(-1) as FlowVersionRow)
        .versionNumber
      const draft = observed.find(
        version => version.versionNumber === draftNumber
      )
      if (draft) {
        session.expected = session.expected.map(version =>
          version.versionNumber === draftNumber
            ? { ...version, id: draft.id }
            : version
        )
      }
    }
    return { observed, deployError }
  }

  private async deployFlow(
    session: Session,
    xml: string,
    marked: boolean
  ): Promise<void> {
    await this.metadata.deploy([
      {
        type: 'Flow',
        fullName: session.source.apiName,
        xml: toDraftXml(xml, marked),
      },
    ])
  }

  // Exactly one Draft must have appeared beside the snapshot, with the
  // original still Active: it is the temporary version.
  private resolveTemporaryVersion(
    session: Session,
    observed: FlowVersionRow[]
  ): number {
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
      await this.deleteCreatedVersions(session)
      await this.assertAtRest(session)
    } catch (revertError: unknown) {
      const problems = [toError(revertError).message]
      if (runError !== undefined) {
        problems.push(toError(runError).message)
      }
      throw new FlowRevertError(session.source.apiName, problems)
    }
  }

  // The original is activated again only over a version this run created:
  // any other Active version — or none at all — is somebody else's doing,
  // and is left as it is.
  private async reactivateOriginal(session: Session): Promise<void> {
    const original = activeRowOf(session.snapshot) as FlowVersionRow
    const active = activeRowOf(await this.readVersions(session))
    if (active?.id === original.id) return
    if (!active || !session.created.has(active.id)) {
      const state = active
        ? `Version ${active.versionNumber} is Active`
        : 'No version is Active'
      throw new Error(
        `${state}, which this run did not do: version ${original.versionNumber} is not activated again`
      )
    }
    await this.versions.activateVersion(
      session.definitionId,
      original.versionNumber
    )
  }

  // Deletes the versions this run's deploys created, and only those: a
  // version that was already there before a deploy survives.
  private async deleteCreatedVersions(session: Session): Promise<void> {
    for (const version of await this.readVersions(session)) {
      if (!session.created.has(version.id)) continue
      if (version.status === ACTIVE) {
        throw new Error(
          `Version ${version.versionNumber} is Active and is not deleted`
        )
      }
      await this.versions.deleteVersion(version)
    }
  }

  // Deploys the Draft's original content back, unless somebody else saved
  // the flow since the run last deployed it: that content is theirs.
  private async restoreDraft(session: Session): Promise<void> {
    await this.assertUntouched(session)
    await this.deployFlow(session, session.source.xml, false)
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
  ): Promise<RunOutcome> {
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

  // Before every write: the org must hold exactly the versions the run last
  // left, record Ids and statuses included. Anything else was done by
  // somebody else meanwhile, and the run stops before writing over it.
  private async assertUntouched(session: Session): Promise<void> {
    const changed = changedVersions(
      session.expected,
      await this.readVersions(session)
    )
    if (changed.length > 0) {
      throw new FlowChangedOutsideRunError(session.source.apiName, changed)
    }
  }

  private assertAtRest(session: Session): Promise<void> {
    return this.assertState(session, stateOf(session.snapshot))
  }

  private async assertState(
    session: Session,
    expected: FlowVersionState
  ): Promise<void> {
    this.checkState(session, expected, await this.readVersions(session))
  }

  private checkState(
    session: Session,
    expected: FlowVersionState,
    observed: FlowVersionRow[]
  ): void {
    const state = stateOf(observed)
    if (!sameState(state, expected)) {
      throw new FlowVersionGuardError(session.source.apiName, expected, state)
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
