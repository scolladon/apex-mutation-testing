import { randomUUID } from 'node:crypto'
import {
  FlowActiveVersionNotDeletedError,
  FlowChangedOutsideRunError,
  FlowDeployFailedError,
  FlowDeployNotCompletedError,
  FlowDraftBesideActiveError,
  FlowForeignActiveVersionError,
  FlowLeftoverVersionError,
  FlowRestoreError,
  FlowRevertError,
  FlowTestChangedOutsideRunError,
  FlowTestLeftoverError,
  FlowTestPinError,
  FlowTestRepinFailedError,
  FlowTestRestorePinError,
  FlowTestsNotRunError,
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
import type {
  FlowMetadataFile,
  FlowMetadataRepository,
} from './flowMetadataRepository.js'
import {
  type FlowTestResultRepository,
  versionsRunBetween,
} from './flowTestResultRepository.js'
import {
  deployMarker,
  leftoverPins,
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
// The outcomes of a FlowTest that ran and did not hold. Any other outcome
// than these and Pass (a skipped test, say) is not evidence either way.
const KILLING_OUTCOMES = new Set(['Fail', 'CompileFail'])

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
// Every XML an evaluation deploys carries TEMPORARY_VERSION_MARKER followed
// by a token unique to the deploy, and every FlowTest the run detaches
// carries a marker of its own: a run interrupted before its restore leaves
// what the next run recognizes and refuses, and a version is only ever taken
// for the run's own when it carries the token of the run's latest deploy.
type Mode = 'activate' | 'overwrite'

interface UnpinnedTest {
  original: FlowTestSource
  // What the run deployed in its place, detached and marked.
  deployed: string
  // What the org held once the run's own deploy landed, read back; undefined
  // when the deploy or the read-back did not get that far.
  readBack: string | undefined
}

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
  // The FlowTests this run detached, recorded before their deploy is
  // attempted so the restore covers a deploy that half-failed.
  unpinned: UnpinnedTest[]
  // A deploy whose outcome is unknown and which may still land: the restore
  // waits for it before it trusts anything it reads.
  pendingDeployId: string | undefined
  // A deploy request that failed before the org returned its id: it may have
  // been queued, and nothing can wait for it, so the restore never reports
  // success.
  untrackedDeploy: boolean
  // Set right before the run's first write is attempted: until then there is
  // nothing to restore.
  wrote: boolean
  // Identifies this run in its deploy markers; with the deploy count, the
  // marker of the latest deploy, the only one observe attributes.
  runId: string
  deploys: number
  latestMarker: string | undefined
  // A flow deploy whose effect has not been read back yet: set right before
  // it, cleared by the reading that follows it. Only that reading attributes
  // versions to the run — later, a colleague's save made from the run's own
  // version carries its marker too.
  unobservedDeploy: boolean
  // 'overwrite' only: the run deployed over the Draft at least once, so its
  // record Id is the run's doing, not evidence of somebody else's save.
  flowDeployed: boolean
}

type RunOutcome = { failingTests: string[]; testsRan: number; runMs: number }

const numbersOf = (versions: FlowVersionRow[]): number[] =>
  versions.map(version => version.versionNumber)

const activeRowOf = (versions: FlowVersionRow[]): FlowVersionRow | undefined =>
  versions.find(version => version.status === ACTIVE)

const activeOf = (versions: FlowVersionRow[]): number | undefined =>
  activeRowOf(versions)?.versionNumber

const isMarked = (version: FlowVersionRow): boolean =>
  version.description.includes(TEMPORARY_VERSION_MARKER)

const carries = (version: FlowVersionRow, marker: string): boolean =>
  version.description.includes(marker)

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

const flowTestFiles = (
  tests: { fullName: string; xml: string }[]
): FlowMetadataFile[] =>
  tests.map(test => ({
    type: 'FlowTest',
    fullName: test.fullName,
    xml: test.xml,
  }))

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
    this.assertNoLeftover(source, snapshot)
    const mode = this.selectMode(source.apiName, snapshot)
    await this.assertSourceIsCurrent(source, definitionId, snapshot)
    // FlowTestResult is read around every run; reading it once before the
    // first write means a user who may not read it is refused before the
    // org was touched.
    await this.results.listResults(definitionId)
    const session: Session = {
      source,
      definitionId,
      snapshot,
      mode,
      expected: snapshot,
      created: new Set(),
      flowTouched: false,
      unpinned: [],
      pendingDeployId: undefined,
      untrackedDeploy: false,
      wrote: false,
      runId: randomUUID().slice(0, 8),
      deploys: 0,
      latestMarker: undefined,
      // Stryker disable next-line BooleanLiteral: before the first flow deploy
      // every version listed is the snapshot's, so a reading would attribute
      // nothing: no new number, and the Draft's own Id adopted again.
      unobservedDeploy: false,
      flowDeployed: false,
    }
    this.session = session
    await this.unpinFlowTests(session)
    hooks.onPrepared()

    // The baseline goes through exactly the path every mutant takes, so the
    // whole cycle — deploy, activation, version check, revert — is proven
    // once on the original before any mutant relies on it.
    hooks.onBaselineStarting()
    const started = performance.now()
    const { failingTests, testsRan, runMs } = await this.runVersion(
      session,
      source.xml
    )
    return {
      testsRan,
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

  public needsRestore(): boolean {
    return this.session?.wrote === true
  }

  // Every step is attempted whatever the outcome of the one before, and the
  // org is then checked against the snapshot taken before the run: the
  // restore only reports success once the versions are exactly those the run
  // started from, with the same one Active and none marked. It only ever
  // undoes what the run did: a version or FlowTest somebody else changed
  // meanwhile is left as it is, and the restore then fails, naming it.
  public async restore(): Promise<void> {
    const session = this.session
    if (!session) return
    if (!session.wrote) {
      this.session = undefined
      return
    }
    if (session.pendingDeployId !== undefined) {
      await this.awaitPendingDeploy(session)
    }
    const failures: Error[] = []
    const attempt = async (step: () => Promise<unknown>) => {
      try {
        await step()
      } catch (error: unknown) {
        failures.push(toError(error))
      }
    }

    // What the run's own deploys made of the versions is read first: a
    // listing that failed during the run would otherwise leave a version the
    // run created, or its Draft's new Id, unrecorded.
    await attempt(() => this.observe(session))
    await attempt(() => this.restoreFlowTests(session))
    if (session.mode === 'activate') {
      await attempt(() => this.reactivateOriginal(session))
    }
    await attempt(() => this.deleteCreatedVersions(session))
    if (session.flowTouched) {
      await attempt(() => this.restoreDraft(session))
    }
    await attempt(() => this.assertAtRest(session))
    if (session.untrackedDeploy) {
      failures.push(
        new FlowDeployNotCompletedError(
          undefined,
          'Unknown',
          true,
          'a deploy request of the run failed before the org returned its id, and may still land'
        )
      )
    }

    if (failures.length > 0) {
      throw new FlowRestoreError(session.source.apiName, failures)
    }
    this.session = undefined
  }

  // Nothing the org says can be trusted while a deploy of the run may still
  // land, so nothing is attempted until it has: then whatever it created is
  // recorded as the run's, like any other deploy's.
  private async awaitPendingDeploy(session: Session): Promise<void> {
    try {
      await this.metadata.awaitDeploy(session.pendingDeployId as string)
      session.pendingDeployId = undefined
      await this.observe(session)
      await this.readBackUnpinned(session)
    } catch (error: unknown) {
      throw new FlowRestoreError(session.source.apiName, [toError(error)])
    }
  }

  // A marked version is a mutant an interrupted run left behind: taken for
  // the original, it would be the source of every mutant and what the
  // restore puts back. A marked FlowTest lost its associations to such a
  // run, and only the marker still says which.
  private assertNoLeftover(
    source: FlowSource,
    snapshot: FlowVersionRow[]
  ): void {
    const leftovers = snapshot.filter(isMarked)
    if (leftovers.length > 0) {
      throw new FlowLeftoverVersionError(source.apiName, numbersOf(leftovers))
    }
    for (const test of source.tests) {
      const pins = leftoverPins(test.xml)
      if (pins !== undefined) {
        throw new FlowTestLeftoverError(source.apiName, test.fullName, pins)
      }
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

  // The source was read before the snapshot was taken. Read again between
  // two listings, it must be byte for byte what the mutants are built from
  // and what the restore would put back, and the versions must not have
  // moved: otherwise a save in between would be written over.
  private async assertSourceIsCurrent(
    source: FlowSource,
    definitionId: string,
    snapshot: FlowVersionRow[]
  ): Promise<void> {
    const files = await this.metadata.retrieve([
      { type: 'Flow', fullNames: [source.apiName] },
      {
        type: 'FlowTest',
        fullNames: source.tests.map(test => test.fullName),
      },
    ])
    const changed = changedVersions(
      snapshot,
      await this.versions.listVersions(definitionId)
    )
    const flow = files.find(file => file.type === 'Flow')
    if (changed.length > 0 || flow?.xml !== source.xml) {
      throw new FlowChangedOutsideRunError(
        source.apiName,
        changed.length > 0
          ? changed
          : [(snapshot.at(-1) as FlowVersionRow).versionNumber],
        true
      )
    }
    const changedTests = source.tests
      .filter(
        test =>
          files.find(
            file => file.type === 'FlowTest' && file.fullName === test.fullName
          )?.xml !== test.xml
      )
      .map(test => test.fullName)
    if (changedTests.length > 0) {
      throw new FlowTestChangedOutsideRunError(changedTests, true)
    }
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
    session.flowDeployed = true
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
  // snapshot before any outcome, verdict or error, leaves this method. A
  // deploy whose outcome is unknown is the exception: nothing read meanwhile
  // can be trusted, so the run stops at once and the restore waits for it.
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
      await this.activateTemporaryVersion(session, temporary)
      outcome = await this.runFlowTests(session, temporary.versionNumber)
    } catch (error: unknown) {
      if (error instanceof FlowDeployNotCompletedError) {
        throw error
      }
      runError = error
    }
    await this.revertTemporaryVersion(session, runError)
    if (outcome === undefined) {
      throw runError
    }
    return outcome
  }

  // Deploys `xml`, marked, then reads the versions back whatever the deploy's
  // outcome — unless that outcome is unknown, which is thrown at once.
  private async deployObserved(
    session: Session,
    xml: string
  ): Promise<{ observed: FlowVersionRow[]; deployError: unknown }> {
    let deployError: unknown
    session.deploys++
    session.latestMarker = deployMarker(session.runId, session.deploys)
    session.unobservedDeploy = true
    try {
      await this.deployTracked(session, [
        {
          type: 'Flow',
          fullName: session.source.apiName,
          xml: toDraftXml(xml, session.latestMarker),
        },
      ])
    } catch (error: unknown) {
      if (error instanceof FlowDeployNotCompletedError) {
        throw error
      }
      deployError = error
    }
    return { observed: await this.observe(session), deployError }
  }

  // Every deploy of the run goes through here, so one whose outcome is
  // unknown and that may still land is never forgotten by the restore.
  // A restore deploy (`cancel` false) is never cancelled on a timeout: it
  // puts the original back, so it is better left to land.
  private async deployTracked(
    session: Session,
    files: FlowMetadataFile[],
    cancel = true
  ): Promise<void> {
    session.wrote = true
    try {
      await this.metadata.deploy(files, cancel)
    } catch (error: unknown) {
      if (error instanceof FlowDeployNotCompletedError) {
        if (error.asyncProcessId === undefined) {
          session.untrackedDeploy = true
        } else if (error.pending) {
          session.pendingDeployId = error.asyncProcessId
        }
      }
      throw error
    }
  }

  // Reads the versions and, the first time after a flow deploy, records what
  // that deploy made of them. Only a version carrying the marker of the run's
  // latest deploy can be the run's: a colleague's save landing during that
  // deploy carries none, and one saved from an earlier temporary version
  // carries an earlier deploy's. So a version with a new number is recorded
  // as created only when it carries that marker, and the Draft's new Id
  // ('overwrite') is adopted only when the Draft does. Any later reading
  // attributes nothing: by then a save made from the run's own version
  // carries that marker too. A reading that failed right after the deploy
  // leaves it to the next one.
  private async observe(session: Session): Promise<FlowVersionRow[]> {
    const observed = await this.readVersions(session)
    if (!session.unobservedDeploy) return observed
    session.unobservedDeploy = false
    const known = new Set(numbersOf(session.expected))
    for (const version of observed) {
      if (
        !known.has(version.versionNumber) &&
        carries(version, session.latestMarker as string)
      ) {
        session.created.add(version.id)
      }
    }
    // Stryker disable next-line ConditionalExpression: in 'activate' mode the
    // snapshot's latest version is the Active original, which no deploy of
    // the run saves over and which is never marked, so nothing is adopted.
    if (session.mode === 'overwrite') {
      const draftNumber = (session.snapshot.at(-1) as FlowVersionRow)
        .versionNumber
      const draft = observed.find(
        version => version.versionNumber === draftNumber
      )
      if (draft && carries(draft, session.latestMarker as string)) {
        session.expected = session.expected.map(version =>
          version.versionNumber === draftNumber
            ? { ...version, id: draft.id }
            : version
        )
      }
    }
    return observed
  }

  // Exactly one Draft must have appeared beside the snapshot, created by the
  // run, with the original still Active: it is the temporary version.
  private resolveTemporaryVersion(
    session: Session,
    observed: FlowVersionRow[]
  ): FlowVersionRow {
    const known = new Set(numbersOf(session.snapshot))
    const created = observed.filter(
      version => !known.has(version.versionNumber)
    )
    if (
      created.length !== 1 ||
      !session.created.has(created[0].id) ||
      created[0].status !== DRAFT ||
      activeOf(observed) !== activeOf(session.snapshot)
    ) {
      throw new FlowVersionGuardError(
        session.source.apiName,
        stateOf(session.snapshot),
        stateOf(observed)
      )
    }
    return created[0]
  }

  // An activation names a version number, and a deleted version's number is
  // given to the next one created: the number must still be the run's own
  // version right before the activation, and the Active version must be
  // that very record right after it.
  private async activateTemporaryVersion(
    session: Session,
    temporary: FlowVersionRow
  ): Promise<void> {
    const before = await this.readVersions(session)
    if (
      before.find(version => version.versionNumber === temporary.versionNumber)
        ?.id !== temporary.id
    ) {
      throw new FlowChangedOutsideRunError(session.source.apiName, [
        temporary.versionNumber,
      ])
    }
    await this.versions.activateVersion(
      session.definitionId,
      temporary.versionNumber
    )
    const after = await this.readVersions(session)
    const activated = after.find(
      version => version.versionNumber === temporary.versionNumber
    )
    // A save landing between the check above and the activation re-keys the
    // run's Draft (the API has no compare-and-swap): the activation, the
    // run's own act, then made somebody else's content Active. It is undone
    // at once — the original Active again — before the run stops.
    if (activated?.status === ACTIVE && activated.id !== temporary.id) {
      await this.versions.activateVersion(
        session.definitionId,
        (activeRowOf(session.snapshot) as FlowVersionRow).versionNumber
      )
      throw new FlowChangedOutsideRunError(session.source.apiName, [
        temporary.versionNumber,
      ])
    }
    this.checkState(
      session,
      {
        numbers: [...numbersOf(session.snapshot), temporary.versionNumber].sort(
          (a, b) => a - b
        ),
        active: temporary.versionNumber,
      },
      after
    )
  }

  // Puts the original back as the Active version and removes the temporary
  // one. Any failure leaves the org away from its snapshot, which is never a
  // verdict: it aborts the run, keeping the test run's own failure as well.
  private async revertTemporaryVersion(
    session: Session,
    runError: unknown
  ): Promise<void> {
    try {
      await this.observe(session)
      await this.reactivateOriginal(session)
      await this.deleteCreatedVersions(session)
      await this.assertAtRest(session)
    } catch (revertError: unknown) {
      const failures = [toError(revertError)]
      if (runError !== undefined) {
        failures.push(toError(runError))
      }
      throw new FlowRevertError(session.source.apiName, failures)
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
      throw new FlowForeignActiveVersionError(
        session.source.apiName,
        active?.versionNumber,
        original.versionNumber
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
        throw new FlowActiveVersionNotDeletedError(version.versionNumber)
      }
      await this.versions.deleteVersion(version)
    }
  }

  // Deploys the Draft's original content back, unless somebody else saved
  // the flow since the run last deployed it: that content is theirs.
  private async restoreDraft(session: Session): Promise<void> {
    await this.assertUntouched(session)
    await this.deployTracked(
      session,
      [
        {
          type: 'Flow',
          fullName: session.source.apiName,
          xml: toDraftXml(session.source.xml, false),
        },
      ],
      false
    )
    session.flowTouched = false
  }

  // Each FlowTest loses its version associations for the run and is marked,
  // deployed, then read back: a FlowTest still associated with versions
  // would be skipped whenever the version under test is not one of them.
  private async unpinFlowTests(session: Session): Promise<void> {
    const unpinned = session.source.tests
      .map(test => ({ test, xml: unpinFlowTest(test.xml) }))
      .filter(({ test, xml }) => xml !== test.xml)
    if (unpinned.length === 0) return

    session.unpinned = unpinned.map(({ test, xml }) => ({
      original: test,
      deployed: xml,
      readBack: undefined,
    }))
    try {
      await this.deployTracked(
        session,
        flowTestFiles(
          unpinned.map(({ test, xml }) => ({ fullName: test.fullName, xml }))
        )
      )
    } catch (error: unknown) {
      throw error instanceof FlowDeployFailedError
        ? new FlowTestRepinFailedError(error.problems)
        : error
    }
    const readBack = await this.readFlowTests(
      session.unpinned.map(entry => entry.original.fullName)
    )
    for (const entry of session.unpinned) {
      const xml = readBack.get(entry.original.fullName)
      if (xml === undefined) {
        throw new FlowTestPinError(entry.original.fullName, [])
      }
      entry.readBack = xml
      const pins = pinnedVersions(xml)
      if (pins.length > 0) {
        throw new FlowTestPinError(entry.original.fullName, pins)
      }
    }
  }

  // Puts back the FlowTests the run detached, and only those still holding
  // what the run left in them: one somebody else edited or deleted meanwhile
  // is theirs, and is reported rather than written over or recreated. The
  // ones put back are read back, and must carry their original associations
  // again.
  private async restoreFlowTests(session: Session): Promise<void> {
    if (session.unpinned.length === 0) return
    const current = await this.readFlowTests(
      session.unpinned.map(entry => entry.original.fullName)
    )
    const restorable: UnpinnedTest[] = []
    const changed: string[] = []
    for (const entry of session.unpinned) {
      const xml = current.get(entry.original.fullName)
      if (xml === entry.original.xml) continue
      // Without a read-back, only the exact XML the run deployed counts as
      // the run's: a colleague's edit keeps the marker, so the marker alone
      // would let the original be written over it.
      const leftByRun = xml === (entry.readBack ?? entry.deployed)
      if (leftByRun) {
        restorable.push(entry)
      } else {
        changed.push(entry.original.fullName)
      }
    }
    if (restorable.length > 0) {
      await this.deployTracked(
        session,
        flowTestFiles(restorable.map(entry => entry.original)),
        false
      )
      const readBack = await this.readFlowTests(
        restorable.map(entry => entry.original.fullName)
      )
      for (const entry of restorable) {
        const expected = pinnedVersions(entry.original.xml)
        // a FlowTest that did not come back has no association at all
        const back = readBack.get(entry.original.fullName)
        const found = back === undefined ? [] : pinnedVersions(back)
        if (
          found.length !== expected.length ||
          found.some((pin, index) => pin !== expected[index])
        ) {
          throw new FlowTestRestorePinError(
            entry.original.fullName,
            expected,
            found
          )
        }
      }
    }
    session.unpinned = []
    if (changed.length > 0) {
      throw new FlowTestChangedOutsideRunError(changed)
    }
  }

  // A pending deploy of the detached FlowTests has landed: what it left is
  // read back now, so the restore compares with what the org actually held.
  private async readBackUnpinned(session: Session): Promise<void> {
    const missing = session.unpinned.filter(
      entry => entry.readBack === undefined
    )
    if (missing.length === 0) return
    const readBack = await this.readFlowTests(
      missing.map(entry => entry.original.fullName)
    )
    for (const entry of missing) {
      entry.readBack = readBack.get(entry.original.fullName)
    }
  }

  private async readFlowTests(names: string[]): Promise<Map<string, string>> {
    const files = await this.metadata.retrieve([
      { type: 'FlowTest', fullNames: names },
    ])
    // only FlowTests were asked for, so only FlowTests come back
    return new Map(files.map(file => [file.fullName, file.xml]))
  }

  // The names of the FlowTests that failed. A run in which a requested
  // FlowTest did not run is not evidence about the version unless another
  // one failed, so it is an error, never "survived"; and the results the org
  // recorded must name the version under test, and only it — the runner
  // itself never says which version it ran.
  private async runFlowTests(
    session: Session,
    expectedVersion: number
  ): Promise<RunOutcome> {
    const requested = session.source.tests.map(test => test.fullName)
    const before = await this.results.listResults(session.definitionId)
    const started = performance.now()
    const result = await this.runner.runFlowTests(
      session.source.apiName,
      requested
    )
    const runMs = performance.now() - started
    const failingTests = result.tests
      .filter(test => KILLING_OUTCOMES.has(test.outcome))
      .map(test => test.methodName)
    if (failingTests.length === 0) {
      // Salesforce names are case-insensitive: the runner may spell one
      // differently from the retrieve.
      const passed = new Set(
        result.tests
          .filter(test => test.outcome === PASS)
          .map(test => test.methodName.toLowerCase())
      )
      const missing = requested.filter(name => !passed.has(name.toLowerCase()))
      if (missing.length > 0) {
        throw new FlowTestsNotRunError(session.source.apiName, missing)
      }
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
    return { failingTests, testsRan: result.tests.length, runMs }
  }

  // Before every write: the org must hold exactly the versions the run last
  // left, record Ids and statuses included. Anything else was done by
  // somebody else meanwhile, and the run stops before writing over it.
  private async assertUntouched(session: Session): Promise<void> {
    const changed = changedVersions(
      session.expected,
      await this.observe(session)
    )
    if (changed.length > 0) {
      throw new FlowChangedOutsideRunError(session.source.apiName, changed)
    }
  }

  // At rest, the org holds the snapshot: the same version numbers, the same
  // one Active, the same record Ids — except the overwritten Draft's, which
  // every save re-keys — and no version carrying the marker.
  private async assertAtRest(session: Session): Promise<void> {
    const observed = await this.readVersions(session)
    this.checkState(session, stateOf(session.snapshot), observed)
    const marked = observed.filter(isMarked)
    if (marked.length > 0) {
      throw new FlowLeftoverVersionError(
        session.source.apiName,
        numbersOf(marked)
      )
    }
    const rekeyed = session.flowDeployed
      ? (session.snapshot.at(-1) as FlowVersionRow).versionNumber
      : undefined
    const changed = changedVersions(session.expected, observed).filter(
      number => number !== rekeyed
    )
    if (changed.length > 0) {
      throw new FlowChangedOutsideRunError(session.source.apiName, changed)
    }
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
