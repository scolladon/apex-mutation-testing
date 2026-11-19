import type { ApexTestRunner } from '../../../../src/adapter/org/apexTestRunner.js'
import type {
  FlowMetadataFile,
  FlowMetadataRepository,
} from '../../../../src/adapter/org/flowMetadataRepository.js'
import type {
  FlowTestResultRepository,
  FlowTestResultRow,
} from '../../../../src/adapter/org/flowTestResultRepository.js'
import {
  pinnedVersions,
  TEMPORARY_VERSION_MARKER,
  unpinFlowTest,
} from '../../../../src/adapter/org/flowVersionEdits.js'
import type {
  FlowVersionRepository,
  FlowVersionRow,
} from '../../../../src/adapter/org/flowVersionRepository.js'
import {
  FLOW_VERSION_LIMIT,
  OrgFlowTestBed,
} from '../../../../src/adapter/org/orgFlowTestBed.js'
import {
  FlowChangedOutsideRunError,
  FlowDeployFailedError,
  FlowDeployNotCompletedError,
  FlowDraftBesideActiveError,
  FlowLeftoverVersionError,
  FlowOrgSafetyError,
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
  UnsupportedFlowVersionStateError,
} from '../../../../src/port/flowErrors.js'
import type { FlowSource } from '../../../../src/port/flowSourceProvider.js'
import type {
  FlowMutantVerdict,
  FlowPrepareHooks,
} from '../../../../src/port/flowTestBed.js'
import {
  flowTestXml,
  recordTriggeredFlowXml,
} from '../../../utils/flowFixtures.js'

type FakeVersion = Omit<FlowVersionRow, 'description'> & { xml: string }

const ORIGINAL_TEST = flowTestXml('Account_After', [1])

// An in-memory org reproducing what a sandbox showed: a deploy while the
// latest version is a Draft overwrites it in place (re-keying its record),
// any other deploy creates a new Draft numbered after the highest; an
// activation makes the previously Active version Obsolete and keeps every
// record Id; a version's description is the one in its XML; and the test
// runner runs a FlowTest against the Active version — the latest when none
// is — skipping a FlowTest associated with versions that exclude it, and
// recording one FlowTestResult row per FlowTest it ran.
class FakeOrg {
  versions: FakeVersion[]
  flowTests = new Map<string, string>([['Sets_Rating', ORIGINAL_TEST]])
  results: FlowTestResultRow[] = []
  deletes: number[] = []
  activations: number[] = []
  flowDeploys: string[] = []
  outcome: (xml: string, test: string) => string = xml =>
    xml.includes('Update') ? 'Fail' : 'Pass'
  // Misbehaviour switches for the guard tests.
  refuseFlow?: (xml: string) => boolean
  refuseActivation?: (versionNumber: number) => boolean
  ignoreActivation = false
  refuseFlowTests = false
  keepPinsOnDeploy = false
  createTwice = false
  createOnEveryDeploy = false
  overwriteOnEveryDeploy = false
  renumberOnOverwrite = false
  failDelete = false
  recordResults = true
  executeOn?: number
  extraResultOn?: number
  fillGaps = false
  dropLatestOnDeploy = false
  // A deploy that lands only once awaitDeploy is called (or never).
  pendingLanding?: () => void
  // The org storing a FlowTest in another spelling than the one deployed.
  normalizeFlowTests = false
  private nextId = 100

  constructor(statuses: string[]) {
    this.versions = statuses.map((status, i) => ({
      id: `301${i + 1}`,
      versionNumber: i + 1,
      status,
      xml: recordTriggeredFlowXml(status),
    }))
  }

  get state(): [number, string][] {
    return this.versions.map(v => [v.versionNumber, v.status])
  }

  private create(xml: string, status = 'Draft'): void {
    const taken = new Set(this.versions.map(v => v.versionNumber))
    let versionNumber = Math.max(0, ...taken) + 1
    if (this.fillGaps) {
      versionNumber = 1
      while (taken.has(versionNumber)) versionNumber++
    }
    this.versions.push({
      id: `301${this.nextId++}`,
      versionNumber,
      status,
      xml,
    })
  }

  // A save of the flow, as a deploy or Flow Builder's Save makes it.
  save(xml: string): void {
    const latest = this.versions.at(-1)
    const overwrite =
      this.overwriteOnEveryDeploy ||
      (latest?.status === 'Draft' && !this.createOnEveryDeploy)
    if (overwrite && latest) {
      latest.id = `301${this.nextId++}`
      latest.xml = xml
      if (this.renumberOnOverwrite) latest.versionNumber += 10
      return
    }
    this.create(xml)
    if (this.createTwice) this.create(xml)
  }

  readonly metadata = {
    deploy: vi.fn(async (files: FlowMetadataFile[]) => {
      for (const file of files) {
        if (file.type === 'FlowTest') {
          if (this.refuseFlowTests) {
            throw new FlowDeployFailedError(['bad test'])
          }
          if (!this.keepPinsOnDeploy) {
            this.flowTests.set(
              file.fullName,
              this.normalizeFlowTests ? `${file.xml}\n` : file.xml
            )
          }
          continue
        }
        if (this.refuseFlow?.(file.xml)) {
          throw new FlowDeployFailedError(['Element invalid'])
        }
        this.flowDeploys.push(file.xml)
        this.save(file.xml)
      }
      if (this.dropLatestOnDeploy) this.versions.pop()
    }),
    // A retrieve returns the Flow's Active version, or its latest when none
    // is Active, and the FlowTests that exist.
    retrieve: vi.fn(async (members: { type: string; fullNames: string[] }[]) =>
      members.flatMap(member => {
        if (member.type === 'Flow') {
          const version =
            this.versions.find(v => v.status === 'Active') ??
            this.versions.at(-1)
          return version
            ? [
                {
                  type: 'Flow' as const,
                  fullName: member.fullNames[0],
                  xml: version.xml,
                },
              ]
            : []
        }
        return member.fullNames
          .filter(fullName => this.flowTests.has(fullName))
          .map(fullName => ({
            type: 'FlowTest' as const,
            fullName,
            xml: this.flowTests.get(fullName) as string,
          }))
      })
    ),
    awaitDeploy: vi.fn(async (_id: string) => {
      this.pendingLanding?.()
      this.pendingLanding = undefined
    }),
  }

  readonly versionRepository = {
    readDefinitionId: vi.fn(async () => '300X'),
    // ordered by version number, as the Tooling query is
    listVersions: vi.fn(async () =>
      this.versions
        .map(({ id, versionNumber, status, xml }) => ({
          id,
          versionNumber,
          status,
          description:
            /<description>([^<]*)<\/description>/.exec(xml)?.[1] ?? '',
        }))
        .sort((a, b) => a.versionNumber - b.versionNumber)
    ),
    activateVersion: vi.fn(async (_definitionId: string, number: number) => {
      if (this.refuseActivation?.(number)) {
        throw new FlowDeployFailedError(['cannot activate'])
      }
      this.activations.push(number)
      if (this.ignoreActivation) return
      for (const version of this.versions) {
        if (version.versionNumber === number) version.status = 'Active'
        else if (version.status === 'Active') version.status = 'Obsolete'
      }
    }),
    deleteVersion: vi.fn(async (version: FlowVersionRow) => {
      if (this.failDelete) throw new Error('paused interview')
      this.deletes.push(version.versionNumber)
      this.versions = this.versions.filter(v => v.id !== version.id)
    }),
  }

  readonly resultRepository = {
    listResults: vi.fn(async () => this.results.map(row => ({ ...row }))),
  }

  readonly runner = {
    runFlowTests: vi.fn(async (_flow: string, testNames: string[]) => {
      const executed =
        this.versions.find(v => v.status === 'Active') ?? this.versions.at(-1)
      const version = executed as FakeVersion
      const tests = testNames
        .filter(name => {
          const pins = pinnedVersions(this.flowTests.get(name) as string)
          return pins.length === 0 || pins.includes(version.versionNumber)
        })
        .map(name => ({
          methodName: name,
          outcome: this.outcome(version.xml, name),
        }))
      if (this.recordResults) {
        for (const _test of tests) {
          this.results.push({
            id: `2hU${this.nextId++}`,
            versionNumber: this.executeOn ?? version.versionNumber,
            modstamp: String(this.nextId),
          })
        }
        if (this.extraResultOn !== undefined) {
          this.results.push({
            id: `2hU${this.nextId++}`,
            versionNumber: this.extraResultOn,
            modstamp: String(this.nextId),
          })
        }
      }
      return {
        outcome: tests.some(test => test.outcome !== 'Pass')
          ? 'Failed'
          : 'Passed',
        tests,
      }
    }),
  }
}

const source = (status: string, tests = [ORIGINAL_TEST]): FlowSource => ({
  apiName: 'Account_After',
  xml: recordTriggeredFlowXml(status),
  tests: tests.map((xml, i) => ({
    fullName: i === 0 ? 'Sets_Rating' : `Test_${i}`,
    xml,
  })),
})

const hooks = (): FlowPrepareHooks => ({
  onPreparing: vi.fn(),
  onPrepared: vi.fn(),
  onBaselineStarting: vi.fn(),
})

const build = (org: FakeOrg) =>
  new OrgFlowTestBed(
    org.metadata as unknown as FlowMetadataRepository,
    org.versionRepository as unknown as FlowVersionRepository,
    org.resultRepository as unknown as FlowTestResultRepository,
    org.runner as unknown as ApexTestRunner
  )

const mutant = (status: string, n: number) =>
  recordTriggeredFlowXml(status).replace('Create', `Update${n}`)

const KILLED = { kind: 'executed', failingTests: ['Sets_Rating'] }

const GUARD_MESSAGE =
  "Flow 'Account_After' versions changed unexpectedly during the run"

// What a colleague saves in Flow Builder while the run goes on.
const COLLEAGUE_XML = recordTriggeredFlowXml('Draft').replace(
  'Create',
  'Delete'
)

// The messages of the failures a FlowRevertError or FlowRestoreError keeps.
const failuresOf = (error: unknown): string[] =>
  (error as { failures: Error[] }).failures.map(failure => failure.message)

const withDescription = (xml: string, description: string): string =>
  xml.replace(
    '<processType>',
    `<description>${description}</description>\n    <processType>`
  )

describe('OrgFlowTestBed', () => {
  describe('a full run against an org that versions flows as a sandbox does', () => {
    it.each([
      ['Active', ['Active']],
      ['Draft', ['Obsolete', 'Draft']],
    ])(
      'Given a %s latest version (%j) and 10 mutants, When run, Then every mutant is executed and the org ends exactly at its snapshot',
      async (status, statuses) => {
        // Arrange — review proof, asserted against the org's real versioning
        const org = new FakeOrg(statuses)
        const snapshot = org.versions.map(v => ({ ...v }))
        const sut = build(org)

        // Act
        await sut.prepare(source(status), hooks())
        const verdicts: FlowMutantVerdict[] = []
        for (let n = 0; n < 10; n++) {
          verdicts.push(await sut.evaluate(mutant(status, n)))
        }
        await sut.restore()

        // Assert
        expect(verdicts).toEqual(Array.from({ length: 10 }, () => KILLED))
        expect(
          org.versions.map(v => [v.versionNumber, v.status, v.xml])
        ).toEqual(snapshot.map(v => [v.versionNumber, v.status, v.xml]))
        expect(org.flowTests.get('Sets_Rating')).toBe(ORIGINAL_TEST)
      }
    )

    it('Given an Active latest version, When the baseline and a mutant run, Then each runs on its own temporary version, activated only while its tests run', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)

      // Act
      await sut.prepare(source('Active'), hooks())
      await sut.evaluate(mutant('Active', 0))
      await sut.restore()

      // Assert
      expect(org.flowDeploys).toHaveLength(2)
      expect(org.activations).toEqual([2, 1, 2, 1])
      expect(org.deletes).toEqual([2, 2])
      expect(org.results.map(row => row.versionNumber)).toEqual([2, 2])
      expect(org.state).toEqual([[1, 'Active']])
    })
  })

  describe('prepare', () => {
    it('Given version numbers the org fills gaps with, When an Active original is evaluated, Then the temporary version is still found and checked in number order', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Obsolete', 'Active'])
      org.versions.splice(1, 1)
      org.fillGaps = true
      const sut = build(org)

      // Act
      await sut.prepare(source('Active'), hooks())
      const verdict = await sut.evaluate(mutant('Active', 0))

      // Assert
      expect(verdict).toEqual(KILLED)
      expect(org.activations).toEqual([2, 3, 2, 3])
      expect(org.state).toEqual([
        [1, 'Obsolete'],
        [3, 'Active'],
      ])
    })

    it('Given a clock, When prepared, Then the baseline cost splits the test run from everything else', async () => {
      // Arrange
      const org = new FakeOrg(['Draft'])
      const now = vi
        .spyOn(performance, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1100)
        .mockReturnValueOnce(1400)
        .mockReturnValueOnce(2000)
      const sut = build(org)

      // Act
      const baseline = await sut.prepare(source('Draft'), hooks())

      // Assert
      expect(baseline.cost).toEqual({ applyMs: 700, runMs: 300 })
      now.mockRestore()
    })

    it('Given an Active latest version, When prepared, Then the FlowTests are unpinned, the original runs as a marked Draft, and the org is back at rest', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      const prepareHooks = hooks()

      // Act
      const baseline = await sut.prepare(source('Active'), prepareHooks)

      // Assert
      expect(org.flowDeploys).toHaveLength(1)
      expect(org.flowDeploys[0]).toContain('<status>Draft</status>')
      // the marker, then the token of this run's first deploy
      expect(org.flowDeploys[0]).toMatch(
        /<description>\[apex-mutation-testing\] run=[0-9a-f]{8}\.1<\/description>/
      )
      expect(
        pinnedVersions(org.flowTests.get('Sets_Rating') as string)
      ).toEqual([])
      expect(baseline).toEqual({
        testsRan: 1,
        failingTests: [],
        cost: { applyMs: expect.any(Number), runMs: expect.any(Number) },
      })
      expect(org.state).toEqual([[1, 'Active']])
      expect(prepareHooks.onPreparing).toHaveBeenCalled()
      expect(prepareHooks.onPrepared).toHaveBeenCalled()
      expect(prepareHooks.onBaselineStarting).toHaveBeenCalled()
      expect(org.runner.runFlowTests).toHaveBeenCalledWith('Account_After', [
        'Sets_Rating',
      ])
    })

    it('Given a Draft latest version with no Active one, When prepared, Then it is overwritten in place, marked, and nothing is activated', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Draft'])
      const sut = build(org)

      // Act
      await sut.prepare(source('Draft'), hooks())

      // Assert
      expect(org.state).toEqual([
        [1, 'Obsolete'],
        [2, 'Draft'],
      ])
      expect(org.versions[1].xml.replace(/ run=[0-9a-f]{8}\.1/, '')).toBe(
        withDescription(
          recordTriggeredFlowXml('Draft'),
          TEMPORARY_VERSION_MARKER
        )
      )
      expect(org.activations).toEqual([])
    })

    it.each([
      [
        'Active',
        ['Active'],
        [
          [1, 'Obsolete'],
          [2, 'Active'],
        ],
      ],
      [
        'Draft',
        ['Obsolete', 'Draft'],
        [
          [1, 'Obsolete'],
          [2, 'Draft'],
        ],
      ],
    ])(
      'Given a run on a %s original interrupted while a surviving mutant was under test, When the command is run again, Then it refuses instead of taking the mutant as the original',
      async (status, statuses, leftState) => {
        // Arrange — review proof: the org exactly as a first run leaves it
        // when its process dies (Ctrl+C, CI cancel, network loss) while a
        // surviving mutant's FlowTests run
        const first = new FakeOrg(statuses)
        first.outcome = () => 'Pass'
        const interrupted = build(first)
        await interrupted.prepare(source(status), hooks())
        let atKill: { versions: FakeVersion[]; test: string } | undefined
        first.runner.runFlowTests.mockImplementationOnce(async () => {
          atKill = {
            versions: first.versions.map(version => ({ ...version })),
            test: first.flowTests.get('Sets_Rating') as string,
          }
          throw new Error('SIGINT')
        })
        await interrupted.evaluate(mutant(status, 0)).catch(() => undefined)
        const left = atKill as { versions: FakeVersion[]; test: string }
        // what the source provider retrieves: the Active version, or the
        // latest when none is — the mutant either way
        const retrieved = (left.versions.find(v => v.status === 'Active') ??
          left.versions.at(-1)) as FakeVersion
        const org = new FakeOrg([])
        org.versions = left.versions.map(version => ({ ...version }))
        org.flowTests.set('Sets_Rating', left.test)
        org.outcome = () => 'Pass'
        const sut = build(org)

        // Act
        const outcome = await sut
          .prepare(
            {
              apiName: 'Account_After',
              xml: retrieved.xml,
              tests: [{ fullName: 'Sets_Rating', xml: left.test }],
            },
            hooks()
          )
          .catch((error: unknown) => error)
        await sut.restore()

        // Assert — first what the interrupted run left, then what the
        // rerun did
        expect(left.versions.map(v => [v.versionNumber, v.status])).toEqual(
          leftState
        )
        expect(retrieved.xml).toContain('Update0')
        expect(retrieved.xml).toContain(TEMPORARY_VERSION_MARKER)
        expect(pinnedVersions(left.test)).toEqual([])
        expect(outcome).toEqual(
          new FlowLeftoverVersionError('Account_After', [2])
        )
        expect(org.metadata.deploy).not.toHaveBeenCalled()
        expect(org.runner.runFlowTests).not.toHaveBeenCalled()
      }
    )

    it('Given a temporary Draft left beside the Active version, When prepared, Then the leftover is named rather than the Draft refused', async () => {
      // Arrange — interrupted between a deploy and its activation
      const org = new FakeOrg(['Active', 'Draft'])
      org.versions[1].xml = withDescription(
        mutant('Draft', 0),
        TEMPORARY_VERSION_MARKER
      )
      const sut = build(org)

      // Act & Assert
      await expect(sut.prepare(source('Active'), hooks())).rejects.toEqual(
        new FlowLeftoverVersionError('Account_After', [2])
      )
    })

    it('Given versions with descriptions of their own, When prepared, Then it proceeds', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Active'])
      for (const version of org.versions) {
        version.xml = withDescription(version.xml, 'Rates [accounts]')
      }
      const sut = build(org)

      // Act & Assert
      await expect(
        sut.prepare({ ...source('Active'), xml: org.versions[1].xml }, hooks())
      ).resolves.toBeDefined()
    })

    it('Given a Draft beside an older Active version, When prepared, Then it refuses before any deploy', async () => {
      // Arrange
      const org = new FakeOrg(['Active', 'Draft'])
      const sut = build(org)

      // Act & Assert
      await expect(sut.prepare(source('Draft'), hooks())).rejects.toEqual(
        new FlowDraftBesideActiveError('Account_After', 2, 1)
      )
      expect(org.metadata.deploy).not.toHaveBeenCalled()
    })

    it.each([
      [['Obsolete'], 'Obsolete'],
      [['Active', 'Obsolete'], 'Obsolete'],
      [['InvalidDraft'], 'InvalidDraft'],
      [[], 'none'],
    ])(
      'Given versions %j, When prepared, Then it refuses before any deploy',
      async (statuses, status) => {
        // Arrange
        const org = new FakeOrg(statuses)
        const sut = build(org)

        // Act & Assert
        await expect(sut.prepare(source('Draft'), hooks())).rejects.toEqual(
          new UnsupportedFlowVersionStateError('Account_After', status)
        )
        expect(org.metadata.deploy).not.toHaveBeenCalled()
        await sut.restore()
        expect(org.metadata.deploy).not.toHaveBeenCalled()
      }
    )

    it('Given an Active flow already at the version limit, When prepared, Then it refuses before any deploy', async () => {
      // Arrange
      const org = new FakeOrg([
        ...Array.from({ length: FLOW_VERSION_LIMIT - 1 }, () => 'Obsolete'),
        'Active',
      ])
      const sut = build(org)

      // Act & Assert
      await expect(sut.prepare(source('Active'), hooks())).rejects.toEqual(
        new FlowVersionLimitError('Account_After', 50, 50)
      )
      expect(org.metadata.deploy).not.toHaveBeenCalled()
    })

    it('Given an Active flow one below the limit, When prepared, Then it proceeds', async () => {
      // Arrange
      const org = new FakeOrg([
        ...Array.from({ length: FLOW_VERSION_LIMIT - 2 }, () => 'Obsolete'),
        'Active',
      ])
      const sut = build(org)

      // Act & Assert
      await expect(
        sut.prepare(source('Active'), hooks())
      ).resolves.toBeDefined()
    })

    it('Given FlowTests the org refuses to unpin, When prepared, Then it fails with a re-pin error before any flow deploy', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Draft'])
      org.refuseFlowTests = true
      const sut = build(org)

      // Act & Assert
      await expect(sut.prepare(source('Draft'), hooks())).rejects.toEqual(
        new FlowTestRepinFailedError(['bad test'])
      )
      expect(org.flowDeploys).toEqual([])
    })

    it('Given a FlowTest deploy failing for another reason, When prepared, Then that error surfaces unchanged', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const failure = new Error('socket hang up')
      org.metadata.deploy.mockRejectedValueOnce(failure)
      const sut = build(org)

      // Act & Assert
      await expect(sut.prepare(source('Active'), hooks())).rejects.toBe(failure)
    })

    it('Given a FlowTest that comes back still pinned, When prepared, Then it aborts with a pin error naming its versions', async () => {
      // Arrange — a FlowTest pinned to the original would be skipped while
      // the temporary version is Active, and every mutant would survive
      const org = new FakeOrg(['Active'])
      org.keepPinsOnDeploy = true
      const sut = build(org)

      // Act & Assert
      await expect(sut.prepare(source('Active'), hooks())).rejects.toEqual(
        new FlowTestPinError('Sets_Rating', [1])
      )
    })

    it('Given a FlowTest missing from the read-back, When prepared, Then it aborts with a pin error', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const retrieve = org.metadata.retrieve.getMockImplementation()
      org.metadata.retrieve
        .mockImplementationOnce(async members =>
          (retrieve as NonNullable<typeof retrieve>)(members)
        )
        .mockResolvedValueOnce([
          {
            type: 'FlowTest',
            fullName: 'Other',
            xml: flowTestXml('Account_After'),
          },
        ])
      const sut = build(org)

      // Act & Assert
      await expect(sut.prepare(source('Active'), hooks())).rejects.toEqual(
        new FlowTestPinError('Sets_Rating', [])
      )
    })

    it('Given FlowTests with no pin, When prepared and restored, Then no FlowTest is deployed, and they are only read to check the source', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Draft'])
      const unpinned = flowTestXml('Account_After')
      org.flowTests.set('Sets_Rating', unpinned)
      const sut = build(org)

      // Act
      await sut.prepare(source('Draft', [unpinned]), hooks())
      await sut.restore()

      // Assert
      expect(org.metadata.deploy).toHaveBeenCalledTimes(2)
      expect(
        org.metadata.deploy.mock.calls.every(([files]) =>
          files.every(file => file.type === 'Flow')
        )
      ).toBe(true)
      expect(org.metadata.retrieve).toHaveBeenCalledTimes(1)
    })

    it('Given one pinned and one unpinned FlowTest, When prepared, Then only the pinned one is deployed and read back', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const unpinned = flowTestXml('Account_After')
      org.flowTests.set('Test_1', unpinned)
      const sut = build(org)

      // Act
      await sut.prepare(source('Active', [ORIGINAL_TEST, unpinned]), hooks())

      // Assert
      const testDeploy = org.metadata.deploy.mock.calls[0][0]
      expect(testDeploy.map(file => file.fullName)).toEqual(['Sets_Rating'])
      expect(org.metadata.retrieve).toHaveBeenCalledWith([
        { type: 'FlowTest', fullNames: ['Sets_Rating'] },
      ])
    })

    it.each([
      ['Active', ['Active']],
      ['Draft', ['Draft']],
    ])(
      'Given an original %s flow the org refuses, When prepared, Then the deploy failure surfaces with the org at rest',
      async (status, statuses) => {
        // Arrange
        const org = new FakeOrg(statuses)
        org.refuseFlow = () => true
        const sut = build(org)

        // Act & Assert
        await expect(
          sut.prepare(source(status), hooks())
        ).rejects.toBeInstanceOf(FlowDeployFailedError)
        expect(org.state).toEqual([[1, status]])
      }
    )

    it('Given a baseline run in which no FlowTest ran, When prepared, Then it fails rather than reporting a pass', async () => {
      // Arrange
      const org = new FakeOrg(['Draft'])
      org.runner.runFlowTests.mockResolvedValueOnce({
        outcome: 'Failed',
        tests: [],
      })
      const sut = build(org)

      // Act & Assert
      await expect(sut.prepare(source('Draft'), hooks())).rejects.toEqual(
        new FlowTestsNotRunError('Account_After', ['Sets_Rating'])
      )
    })

    it('Given failing baseline tests, When prepared, Then only their names are returned', async () => {
      // Arrange
      const org = new FakeOrg(['Draft'])
      const second = flowTestXml('Account_After')
      org.flowTests.set('Test_1', second)
      org.outcome = (_xml, test) => (test === 'Test_1' ? 'Fail' : 'Pass')
      const sut = build(org)

      // Act
      const baseline = await sut.prepare(
        source('Draft', [ORIGINAL_TEST, second]),
        hooks()
      )

      // Assert
      expect(baseline.failingTests).toEqual(['Test_1'])
      expect(baseline.testsRan).toBe(2)
    })
  })

  describe('evaluate', () => {
    it('Given no prepare, When evaluating, Then it refuses', async () => {
      // Act & Assert
      await expect(build(new FakeOrg(['Draft'])).evaluate('x')).rejects.toThrow(
        'prepare() must be called before evaluate()'
      )
    })

    it('Given an Active original, When a mutant is evaluated, Then it reaches the org as a marked Draft and is the version its tests ran on', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.flowDeploys = []

      // Act
      const verdict = await sut.evaluate(mutant('Active', 0))

      // Assert
      expect(verdict).toEqual(KILLED)
      expect(org.flowDeploys[0]).toContain(
        '<recordTriggerType>Update0</recordTriggerType>'
      )
      expect(org.flowDeploys[0]).toContain('<status>Draft</status>')
      expect(org.flowDeploys[0]).toContain(TEMPORARY_VERSION_MARKER)
    })

    it('Given tests that still pass, When evaluated, Then the verdict names no failing test', async () => {
      // Arrange
      const org = new FakeOrg(['Draft'])
      org.outcome = () => 'Pass'
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks())

      // Act & Assert
      await expect(sut.evaluate(mutant('Draft', 0))).resolves.toEqual({
        kind: 'executed',
        failingTests: [],
      })
    })

    it.each([['Active'], ['Draft']])(
      'Given a %s original and a mutant the org refuses, When evaluated, Then it is a not-compilable verdict and the org is at rest',
      async status => {
        // Arrange
        const org = new FakeOrg([status])
        const sut = build(org)
        await sut.prepare(source(status), hooks())
        org.refuseFlow = xml => xml.includes('Update0')

        // Act & Assert
        await expect(sut.evaluate(mutant(status, 0))).resolves.toEqual({
          kind: 'not-compilable',
          detail: 'Deployment failed: Element invalid',
        })
        expect(org.runner.runFlowTests).toHaveBeenCalledTimes(1)
        expect(org.state).toEqual([[1, status]])
      }
    )

    it('Given a mutant the org refuses to activate, When evaluated, Then it is a not-compilable verdict and the temporary version is deleted', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.refuseActivation = number => number === 2

      // Act & Assert
      await expect(sut.evaluate(mutant('Active', 0))).resolves.toEqual({
        kind: 'not-compilable',
        detail: 'Deployment failed: cannot activate',
      })
      expect(org.state).toEqual([[1, 'Active']])
    })

    it.each([['Active'], ['Draft']])(
      'Given a %s original and a mutant deploy failing for an infrastructure reason, When evaluated, Then the error propagates',
      async status => {
        // Arrange
        const org = new FakeOrg([status])
        const sut = build(org)
        await sut.prepare(source(status), hooks())
        org.metadata.deploy.mockRejectedValueOnce(new Error('ECONNRESET'))

        // Act & Assert
        await expect(sut.evaluate(mutant(status, 0))).rejects.toThrow(
          'ECONNRESET'
        )
      }
    )

    it('Given the test transport fails on a mutant run, When evaluated, Then it throws instead of reporting failing tests, with the original Active again', async () => {
      // Arrange — review proof: a transport error must never read as Killed
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.runner.runFlowTests.mockRejectedValueOnce(new Error('socket hang up'))

      // Act & Assert
      await expect(sut.evaluate(mutant('Active', 0))).rejects.toThrow(
        'socket hang up'
      )
      expect(org.state).toEqual([[1, 'Active']])
    })

    it.each([
      [
        'no result',
        (org: FakeOrg) => {
          org.recordResults = false
        },
        [],
      ],
      [
        'a result on the original version',
        (org: FakeOrg) => {
          org.executeOn = 1
        },
        [1],
      ],
      [
        'results on the version under test and on the original',
        (org: FakeOrg) => {
          org.extraResultOn = 1
        },
        [2, 1],
      ],
    ])(
      'Given the org recording %s for the run, When a mutant is evaluated, Then it aborts with a version error',
      async (_label, misbehave, executed) => {
        // Arrange
        const org = new FakeOrg(['Active'])
        const sut = build(org)
        await sut.prepare(source('Active'), hooks())
        misbehave(org)

        // Act & Assert
        await expect(sut.evaluate(mutant('Active', 0))).rejects.toEqual(
          new FlowTestVersionError('Account_After', 2, executed)
        )
        expect(org.state).toEqual([[1, 'Active']])
      }
    )

    it.each([
      [
        'two versions created',
        (org: FakeOrg) => {
          org.createTwice = true
        },
      ],
      [
        'a version created other than Draft',
        (org: FakeOrg) => {
          const deploy = org.metadata.deploy.getMockImplementation()
          org.metadata.deploy.mockImplementationOnce(async files => {
            await deploy?.(files)
            ;(org.versions.at(-1) as FakeVersion).status = 'Obsolete'
          })
        },
      ],
      [
        'an activation the org ignores',
        (org: FakeOrg) => {
          org.ignoreActivation = true
        },
      ],
    ])(
      'Given %s, When a mutant is evaluated against an Active original, Then it aborts with a guard error',
      async (_label, misbehave) => {
        // Arrange
        const org = new FakeOrg(['Active'])
        const sut = build(org)
        await sut.prepare(source('Active'), hooks())
        misbehave(org)

        // Act & Assert
        await expect(sut.evaluate(mutant('Active', 0))).rejects.toBeInstanceOf(
          FlowVersionGuardError
        )
      }
    )

    it.each([
      [
        'the original overwritten instead of a version created',
        (org: FakeOrg) => {
          org.overwriteOnEveryDeploy = true
        },
        "Flow 'Account_After' has version 1 Active, which this run did not set: version 1 is not activated again",
      ],
      [
        'the original no longer Active',
        (org: FakeOrg) => {
          const deploy = org.metadata.deploy.getMockImplementation()
          org.metadata.deploy.mockImplementationOnce(async files => {
            await deploy?.(files)
            org.versions[0].status = 'Obsolete'
          })
        },
        "Flow 'Account_After' has no Active version, which this run did not set: version 1 is not activated again",
      ],
    ])(
      'Given %s, When a mutant is evaluated against an Active original, Then nothing is activated over a version the run did not create',
      async (_label, misbehave, revertProblem) => {
        // Arrange
        const org = new FakeOrg(['Active'])
        const sut = build(org)
        await sut.prepare(source('Active'), hooks())
        org.activations = []
        misbehave(org)

        // Act
        const error = await sut.evaluate(mutant('Active', 0)).catch(e => e)

        // Assert
        expect(error).toBeInstanceOf(FlowRevertError)
        expect(failuresOf(error)).toEqual([revertProblem, GUARD_MESSAGE])
        expect(org.activations).toEqual([])
      }
    )

    it.each([
      [
        'a deploy creating a version',
        (org: FakeOrg) => {
          org.createOnEveryDeploy = true
        },
      ],
      [
        'a deploy renumbering the Draft',
        (org: FakeOrg) => {
          org.renumberOnOverwrite = true
        },
      ],
      [
        'a deploy dropping the Draft',
        (org: FakeOrg) => {
          org.dropLatestOnDeploy = true
        },
      ],
      [
        'a refused deploy that created a version',
        (org: FakeOrg) => {
          org.refuseFlow = () => {
            org.versions.push({
              id: '301z',
              versionNumber: 9,
              status: 'Draft',
              xml: '',
            })
            return true
          }
        },
      ],
    ])(
      'Given %s, When a mutant is evaluated against a Draft original, Then it aborts with a guard error',
      async (_label, misbehave) => {
        // Arrange
        const org = new FakeOrg(['Obsolete', 'Draft'])
        const sut = build(org)
        await sut.prepare(source('Draft'), hooks())
        misbehave(org)

        // Act & Assert
        await expect(sut.evaluate(mutant('Draft', 0))).rejects.toBeInstanceOf(
          FlowVersionGuardError
        )
      }
    )

    it('Given the original cannot be activated again, When a mutant is evaluated, Then it aborts with a revert error', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.refuseActivation = number => number === 1

      // Act
      const error = await sut.evaluate(mutant('Active', 0)).catch(e => e)

      // Assert
      expect(error).toBeInstanceOf(FlowRevertError)
      expect(failuresOf(error)).toEqual(['Deployment failed: cannot activate'])
      expect((error as FlowRevertError).cause).toBeInstanceOf(
        FlowDeployFailedError
      )
    })

    it.each([
      [new Error('socket hang up'), 'socket hang up'],
      ['down', 'down'],
    ])(
      'Given a failed test run (%s) and a failed revert, When evaluated, Then the revert error keeps both',
      async (failure, text) => {
        // Arrange
        const org = new FakeOrg(['Active'])
        const sut = build(org)
        await sut.prepare(source('Active'), hooks())
        org.runner.runFlowTests.mockRejectedValueOnce(failure)
        org.failDelete = true

        // Act
        const error = await sut.evaluate(mutant('Active', 0)).catch(e => e)

        // Assert
        expect(error).toBeInstanceOf(FlowRevertError)
        expect(failuresOf(error)).toEqual(['paused interview', text])
      }
    )
  })

  describe('changes made outside the run', () => {
    it.each([
      ['right after the baseline', 0],
      ['after a mutant', 1],
    ])(
      'Given a colleague saves a new Draft version %s, When the next mutant is evaluated, Then the run stops and that version is neither overwritten nor deleted',
      async (_label, evaluatedBefore) => {
        // Arrange — review proof; the colleague's version takes number 2,
        // which the run's deleted temporary versions had
        const org = new FakeOrg(['Active'])
        const sut = build(org)
        await sut.prepare(source('Active'), hooks())
        for (let n = 0; n < evaluatedBefore; n++) {
          await sut.evaluate(mutant('Active', n))
        }
        org.save(COLLEAGUE_XML)
        org.flowDeploys = []

        // Act
        const error = await sut
          .evaluate(mutant('Active', evaluatedBefore))
          .catch(e => e)
        const restoreError = await sut.restore().catch(e => e)

        // Assert
        expect(error).toEqual(
          new FlowChangedOutsideRunError('Account_After', [2])
        )
        expect(error).toBeInstanceOf(FlowOrgSafetyError)
        expect(org.flowDeploys).toEqual([])
        expect(org.versions.find(v => v.versionNumber === 2)?.xml).toBe(
          COLLEAGUE_XML
        )
        // only the run's own temporary versions: the baseline's, then one
        // per mutant evaluated before the colleague's save
        expect(org.deletes).toEqual(
          Array.from({ length: evaluatedBefore + 1 }, () => 2)
        )
        expect(restoreError).toBeInstanceOf(FlowRestoreError)
        expect(
          (restoreError as FlowRestoreError).failures.map(f => f.message)
        ).toEqual([GUARD_MESSAGE])
      }
    )

    it.each([
      [
        'activates an older version',
        (org: FakeOrg) => {
          org.versions[0].status = 'Active'
          org.versions[1].status = 'Obsolete'
        },
        [1, 2],
        "Flow 'Account_After' has version 1 Active, which this run did not set: version 2 is not activated again",
      ],
      [
        'deactivates the flow',
        (org: FakeOrg) => {
          org.versions[1].status = 'Obsolete'
        },
        [2],
        "Flow 'Account_After' has no Active version, which this run did not set: version 2 is not activated again",
      ],
      [
        'deletes an Obsolete version',
        (org: FakeOrg) => {
          org.versions.shift()
        },
        [1],
        undefined,
      ],
    ])(
      'Given a colleague %s between two evaluations, When the next mutant is evaluated, Then the run stops before writing and the restore leaves it so',
      async (_label, change, changed, restoreProblem) => {
        // Arrange
        const org = new FakeOrg(['Obsolete', 'Active'])
        const sut = build(org)
        await sut.prepare(source('Active'), hooks())
        change(org)
        const state = org.state
        org.activations = []
        org.flowDeploys = []

        // Act
        const error = await sut.evaluate(mutant('Active', 0)).catch(e => e)
        const restoreError = (await sut
          .restore()
          .catch(e => e)) as FlowRestoreError

        // Assert
        expect(error).toEqual(
          new FlowChangedOutsideRunError('Account_After', changed)
        )
        expect(org.flowDeploys).toEqual([])
        expect(org.activations).toEqual([])
        expect(org.state).toEqual(state)
        expect(restoreError.failures.map(f => f.message)).toEqual(
          [restoreProblem, GUARD_MESSAGE].filter(Boolean)
        )
      }
    )

    it('Given changes on versions listed out of number order, When the next mutant is evaluated, Then the changed versions are named in number order', async () => {
      // Arrange — the colleague deactivates version 3 and saves a version the
      // org numbers 2, filling the gap
      const org = new FakeOrg(['Obsolete', 'Obsolete', 'Active'])
      org.versions.splice(1, 1)
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.versions[1].status = 'Obsolete'
      org.fillGaps = true
      org.save(COLLEAGUE_XML)

      // Act & Assert
      await expect(sut.evaluate(mutant('Active', 0))).rejects.toEqual(
        new FlowChangedOutsideRunError('Account_After', [2, 3])
      )
    })

    it('Given a colleague saves a version while a mutant is under test, When it is evaluated, Then only the temporary version is deleted and the run stops', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      const run = org.runner.runFlowTests.getMockImplementation()
      org.runner.runFlowTests.mockImplementationOnce(async (flow, tests) => {
        org.save(COLLEAGUE_XML)
        return (run as NonNullable<typeof run>)(flow, tests)
      })
      org.deletes = []

      // Act & Assert
      await expect(sut.evaluate(mutant('Active', 0))).rejects.toBeInstanceOf(
        FlowRevertError
      )
      expect(org.deletes).toEqual([2])
      expect(org.state).toEqual([
        [1, 'Active'],
        [3, 'Draft'],
      ])
      expect(org.versions[1].xml).toBe(COLLEAGUE_XML)
    })

    it.each([
      [
        'saves over the Draft',
        (org: FakeOrg) => {
          org.save(COLLEAGUE_XML)
        },
      ],
      [
        'saves a new version beside the Draft',
        (org: FakeOrg) => {
          org.createOnEveryDeploy = true
          org.save(COLLEAGUE_XML)
          org.createOnEveryDeploy = false
        },
      ],
    ])(
      'Given a colleague %s between two evaluations of a Draft original, When the restore runs, Then the original content is not deployed over their work',
      async (_label, change) => {
        // Arrange
        const org = new FakeOrg(['Obsolete', 'Draft'])
        const sut = build(org)
        await sut.prepare(source('Draft'), hooks())
        change(org)
        org.flowDeploys = []

        // Act
        const error = await sut.evaluate(mutant('Draft', 0)).catch(e => e)
        const restoreError = (await sut
          .restore()
          .catch(e => e)) as FlowRestoreError

        // Assert
        expect(error).toBeInstanceOf(FlowChangedOutsideRunError)
        expect(org.flowDeploys).toEqual([])
        expect(org.versions.at(-1)?.xml).toBe(COLLEAGUE_XML)
        expect(restoreError.failures[0]).toBeInstanceOf(
          FlowChangedOutsideRunError
        )
        expect(org.deletes).toEqual([])
      }
    )
  })

  describe('restore', () => {
    it('Given no prepare, When restoring, Then nothing happens', async () => {
      // Arrange
      const org = new FakeOrg(['Draft'])

      // Act
      await build(org).restore()

      // Assert
      expect(org.metadata.deploy).not.toHaveBeenCalled()
    })

    it('Given an overwritten Draft, When restored, Then its original content is deployed back as retrieved and the tests restored', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Draft'])
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks())
      await sut.evaluate(mutant('Draft', 0))

      // Act
      await sut.restore()

      // Assert
      expect(org.versions[1].xml).toBe(recordTriggeredFlowXml('Draft'))
      expect(org.flowTests.get('Sets_Rating')).toBe(ORIGINAL_TEST)
      expect(org.deletes).toEqual([])
    })

    it('Given a temporary version left Active, When restored, Then the original is activated again and the temporary version deleted', async () => {
      // Arrange — a revert that could not activate the original
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.refuseActivation = number => number === 1
      await sut.evaluate(mutant('Active', 0)).catch(() => undefined)
      org.refuseActivation = undefined
      expect(org.state).toEqual([
        [1, 'Obsolete'],
        [2, 'Active'],
      ])
      org.activations = []
      org.deletes = []

      // Act
      await sut.restore()

      // Assert
      expect(org.activations).toEqual([1])
      expect(org.deletes).toEqual([2])
      expect(org.state).toEqual([[1, 'Active']])
    })

    it('Given a restore that succeeded, When restored again, Then nothing more happens', async () => {
      // Arrange
      const org = new FakeOrg(['Draft'])
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks())
      await sut.restore()
      org.metadata.deploy.mockClear()

      // Act
      await sut.restore()

      // Assert
      expect(org.metadata.deploy).not.toHaveBeenCalled()
    })

    it('Given a delete that fails, When restored, Then every other step still runs and the failure is reported', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.failDelete = true
      await sut.evaluate(mutant('Active', 0)).catch(() => undefined)

      // Act
      const error = await sut.restore().catch((e: unknown) => e)

      // Assert
      expect(error).toBeInstanceOf(FlowRestoreError)
      expect((error as FlowRestoreError).failures.map(f => f.message)).toEqual([
        'paused interview',
        GUARD_MESSAGE,
      ])
      expect(org.flowTests.get('Sets_Rating')).toBe(ORIGINAL_TEST)
    })

    it('Given an extra version Active and the original refusing activation, When restored, Then the extra version is never deleted and the restore fails', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.refuseActivation = number => number === 1
      await sut.evaluate(mutant('Active', 0)).catch(() => undefined)
      org.refuseActivation = () => true
      org.deletes = []

      // Act
      const error = (await sut
        .restore()
        .catch((e: unknown) => e)) as FlowRestoreError

      // Assert
      expect(org.deletes).toEqual([])
      expect(error.failures.map(f => f.message)).toEqual([
        'Deployment failed: cannot activate',
        'Version 2 is Active and is not deleted',
        GUARD_MESSAGE,
      ])
    })

    it('Given a non-Error failure in a step, When restored, Then it is kept as an Error', async () => {
      // Arrange
      const org = new FakeOrg(['Draft'])
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks())
      org.metadata.deploy.mockRejectedValueOnce('down')

      // Act
      const error = (await sut
        .restore()
        .catch((e: unknown) => e)) as FlowRestoreError

      // Assert
      expect(error.failures[0]).toEqual(new Error('down'))
      expect(error.cause).toBe(error.failures[0])
    })

    it('Given a Draft original whose prepare failed before the first flow deploy, When restored, Then only the FlowTests are deployed back', async () => {
      // Arrange
      const org = new FakeOrg(['Draft'])
      org.refuseFlowTests = true
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks()).catch(() => undefined)
      org.refuseFlowTests = false

      // Act
      await sut.restore()

      // Assert
      expect(org.flowDeploys).toEqual([])
      expect(org.flowTests.get('Sets_Rating')).toBe(ORIGINAL_TEST)
    })
  })

  describe('needsRestore', () => {
    it('Given no prepare, a refusal before any write, a prepare and a restore, When asked, Then it says whether anything is to be restored', async () => {
      // Arrange
      const refused = build(new FakeOrg(['Active', 'Draft']))
      const org = new FakeOrg(['Active'])
      const sut = build(org)

      // Act & Assert
      expect(sut.needsRestore()).toBe(false)
      await refused.prepare(source('Draft'), hooks()).catch(() => undefined)
      expect(refused.needsRestore()).toBe(false)
      await sut.prepare(source('Active'), hooks())
      expect(sut.needsRestore()).toBe(true)
      await sut.restore()
      expect(sut.needsRestore()).toBe(false)
    })
  })

  describe('a colleague saving while a deploy of the run is in flight', () => {
    it.each([
      ['saves a new version', true, [2]],
      ['saves over the temporary Draft', false, []],
    ])(
      'Given a colleague %s while the mutant deploy is in flight, When the mutant is evaluated, Then the run stops and their version is neither overwritten nor deleted',
      async (_label, asNewVersion, deleted) => {
        // Arrange — review proof (round 3): the colleague's save lands
        // between the run's deploy and its listing
        const org = new FakeOrg(['Active'])
        const sut = build(org)
        await sut.prepare(source('Active'), hooks())
        const deploy = org.metadata.deploy.getMockImplementation()
        org.metadata.deploy.mockImplementationOnce(async files => {
          await deploy?.(files)
          org.createOnEveryDeploy = asNewVersion
          org.save(COLLEAGUE_XML)
          org.createOnEveryDeploy = false
        })
        org.deletes = []

        // Act
        const outcome = await sut.evaluate(mutant('Active', 0)).then(
          verdict => verdict,
          error => error
        )
        await sut.restore().catch(() => undefined)

        // Assert
        expect(org.versions.map(v => v.xml)).toContain(COLLEAGUE_XML)
        expect(outcome).toBeInstanceOf(FlowOrgSafetyError)
        expect(org.deletes).toEqual(deleted)
      }
    )

    it('Given a colleague saves over the Draft while the mutant deploy is in flight, When the next write comes, Then it is refused and the restore leaves their content', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Draft'])
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks())
      const deploy = org.metadata.deploy.getMockImplementation()
      org.metadata.deploy.mockImplementationOnce(async files => {
        await deploy?.(files)
        org.save(COLLEAGUE_XML)
      })
      await sut.evaluate(mutant('Draft', 0))
      org.flowDeploys = []

      // Act
      const error = await sut.evaluate(mutant('Draft', 1)).catch(e => e)
      const restoreError = await sut.restore().catch(e => e)

      // Assert
      expect(error).toEqual(
        new FlowChangedOutsideRunError('Account_After', [2])
      )
      expect(restoreError).toBeInstanceOf(FlowRestoreError)
      expect(org.flowDeploys).toEqual([])
      expect(org.versions[1].xml).toBe(COLLEAGUE_XML)
    })
  })

  describe('the source read again before the first write', () => {
    it('Given flow content that is not the source the mutants come from, When prepared, Then it refuses before any write, naming the latest version', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Active'])
      const sut = build(org)

      // Act & Assert
      await expect(
        sut.prepare({ ...source('Active'), xml: mutant('Active', 0) }, hooks())
      ).rejects.toEqual(
        new FlowChangedOutsideRunError('Account_After', [2], true)
      )
      expect(org.metadata.deploy).not.toHaveBeenCalled()
      expect(sut.needsRestore()).toBe(false)
    })

    it('Given a retrieve that returns no flow, When prepared, Then it refuses before any write', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      org.metadata.retrieve.mockResolvedValueOnce([])
      const sut = build(org)

      // Act & Assert
      await expect(sut.prepare(source('Active'), hooks())).rejects.toEqual(
        new FlowChangedOutsideRunError('Account_After', [1], true)
      )
    })

    it('Given a version saved between the two listings, When prepared, Then it refuses naming it, before any write', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const list = org.versionRepository.listVersions.getMockImplementation()
      org.versionRepository.listVersions.mockImplementationOnce(async () => {
        const rows = await (list as NonNullable<typeof list>)()
        org.save(COLLEAGUE_XML)
        return rows
      })
      const sut = build(org)

      // Act & Assert
      await expect(sut.prepare(source('Active'), hooks())).rejects.toEqual(
        new FlowChangedOutsideRunError('Account_After', [2], true)
      )
      expect(org.metadata.deploy).not.toHaveBeenCalled()
    })

    it.each([
      [
        'edited',
        (org: FakeOrg) => {
          org.flowTests.set('Sets_Rating', flowTestXml('Account_After', [3]))
        },
      ],
      [
        'deleted',
        (org: FakeOrg) => {
          org.flowTests.delete('Sets_Rating')
        },
      ],
    ])(
      'Given a FlowTest %s since it was read, When prepared, Then it refuses before any write',
      async (_label, change) => {
        // Arrange
        const org = new FakeOrg(['Active'])
        change(org)
        const sut = build(org)

        // Act & Assert
        await expect(sut.prepare(source('Active'), hooks())).rejects.toEqual(
          new FlowTestChangedOutsideRunError(['Sets_Rating'], true)
        )
        expect(org.metadata.deploy).not.toHaveBeenCalled()
      }
    )

    it('Given a FlowTest an interrupted run left detached, When prepared, Then it refuses quoting the associations to put back', async () => {
      // Arrange
      const left = unpinFlowTest(flowTestXml('Account_After', [3, 4]))
      const org = new FakeOrg(['Active'])
      org.flowTests.set('Sets_Rating', left)
      const sut = build(org)

      // Act & Assert
      await expect(
        sut.prepare(source('Active', [left]), hooks())
      ).rejects.toEqual(
        new FlowTestLeftoverError('Account_After', 'Sets_Rating', [3, 4])
      )
      expect(org.metadata.deploy).not.toHaveBeenCalled()
    })
  })

  describe('FlowTests restored only where the run left them', () => {
    it('Given a FlowTest detached for the run, When prepared, Then it is marked with the associations it had', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)

      // Act
      await sut.prepare(source('Active'), hooks())

      // Assert
      expect(org.flowTests.get('Sets_Rating')).toContain(
        '[apex-mutation-testing pins=1]'
      )
    })

    it.each([
      [
        'edits',
        (org: FakeOrg) => {
          org.flowTests.set('Sets_Rating', flowTestXml('Account_After', [7]))
        },
        flowTestXml('Account_After', [7]),
      ],
      [
        'deletes',
        (org: FakeOrg) => {
          org.flowTests.delete('Sets_Rating')
        },
        undefined,
      ],
    ])(
      'Given a colleague %s a detached FlowTest during the run, When restored, Then it is not written over nor recreated, and the restore fails naming it',
      async (_label, change, left) => {
        // Arrange
        const org = new FakeOrg(['Active'])
        const sut = build(org)
        await sut.prepare(source('Active'), hooks())
        change(org)

        // Act
        const error = await sut.restore().catch(e => e)

        // Assert
        expect(error).toBeInstanceOf(FlowRestoreError)
        expect(failuresOf(error)).toEqual([
          'FlowTests changed outside the run: Sets_Rating',
        ])
        expect(org.flowTests.get('Sets_Rating')).toBe(left)
      }
    )

    it('Given a FlowTest that comes back with other associations once put back, When restored, Then the restore fails naming both', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.metadata.deploy.mockImplementationOnce(async () => {
        org.flowTests.set('Sets_Rating', flowTestXml('Account_After', [9]))
      })

      // Act
      const error = await sut.restore().catch(e => e)

      // Assert
      expect((error as FlowRestoreError).failures).toEqual([
        new FlowTestRestorePinError('Sets_Rating', [1], [9]),
      ])
    })

    it('Given a FlowTest that does not come back once put back, When restored, Then it is reported with no association', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.metadata.deploy.mockImplementationOnce(async () => {
        org.flowTests.delete('Sets_Rating')
      })

      // Act
      const error = await sut.restore().catch(e => e)

      // Assert
      expect((error as FlowRestoreError).failures).toEqual([
        new FlowTestRestorePinError('Sets_Rating', [1], []),
      ])
    })

    it.each([
      ['the detached FlowTest', undefined, ORIGINAL_TEST],
      [
        'something else',
        flowTestXml('Account_After', [5]),
        flowTestXml('Account_After', [5]),
      ],
    ])(
      'Given a read-back that failed and the org holding %s, When restored, Then only what the run left is put back',
      async (_label, change, left) => {
        // Arrange
        const org = new FakeOrg(['Active'])
        const retrieve = org.metadata.retrieve.getMockImplementation()
        org.metadata.retrieve
          .mockImplementationOnce(async members =>
            (retrieve as NonNullable<typeof retrieve>)(members)
          )
          .mockRejectedValueOnce(new Error('socket hang up'))
        const sut = build(org)
        await sut.prepare(source('Active'), hooks()).catch(() => undefined)
        if (change) org.flowTests.set('Sets_Rating', change)

        // Act
        await sut.restore().catch(() => undefined)

        // Assert
        expect(org.flowTests.get('Sets_Rating')).toBe(left)
      }
    )

    it('Given a restore that failed after the Draft was put back, When restored again, Then the Draft is not deployed a second time', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Draft'])
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks())
      org.flowTests.delete('Sets_Rating')
      await sut.restore().catch(() => undefined)
      org.flowDeploys = []

      // Act
      await sut.restore()

      // Assert
      expect(org.flowDeploys).toEqual([])
      expect(org.versions[1].xml).toBe(recordTriggeredFlowXml('Draft'))
    })
  })

  describe('activation of the record the run created', () => {
    it('Given the temporary version number taken over by a version of a colleague before the activation, When evaluated, Then it is not activated and the run stops', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      const list = org.versionRepository.listVersions.getMockImplementation()
      const real = async () => (list as NonNullable<typeof list>)()
      org.versionRepository.listVersions
        .mockImplementationOnce(real)
        .mockImplementationOnce(real)
        .mockImplementationOnce(async () => {
          const temporary = org.versions[1]
          temporary.id = '301colleague'
          temporary.xml = COLLEAGUE_XML
          return real()
        })
      org.activations = []

      // Act
      const error = await sut.evaluate(mutant('Active', 0)).catch(e => e)

      // Assert
      expect(error).toBeInstanceOf(FlowRevertError)
      expect(failuresOf(error)[1]).toBe(
        "Flow 'Account_After' was changed outside the run (versions 2)"
      )
      expect(org.activations).toEqual([])
      expect(org.versions[1].xml).toBe(COLLEAGUE_XML)
    })

    it('Given a colleague saving over the temporary Draft as it is activated, When evaluated, Then the run undoes its own activation at once and stops, their content kept', async () => {
      // Arrange — seen on a sandbox: the save lands between the Id check and
      // the activation, which names a number, so it activates their record
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      const activate =
        org.versionRepository.activateVersion.getMockImplementation()
      org.versionRepository.activateVersion.mockImplementationOnce(
        async (definitionId, number) => {
          org.versions[1].id = '301colleague'
          org.versions[1].xml = COLLEAGUE_XML
          await activate?.(definitionId, number)
        }
      )
      org.activations = []

      // Act
      const error = await sut.evaluate(mutant('Active', 0)).catch(e => e)

      // Assert
      expect(org.activations).toEqual([2, 1])
      expect(org.state).toEqual([
        [1, 'Active'],
        [2, 'Obsolete'],
      ])
      expect(org.versions[1].xml).toBe(COLLEAGUE_XML)
      expect(org.deletes).toEqual([2])
      expect(error).toBeInstanceOf(FlowRevertError)
      expect(failuresOf(error)[1]).toBe(
        "Flow 'Account_After' was changed outside the run (versions 2)"
      )
    })

    it('Given another version than the temporary one Active after the activation, When evaluated, Then the run stops without activating the original over it', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      const activate =
        org.versionRepository.activateVersion.getMockImplementation()
      org.versionRepository.activateVersion.mockImplementationOnce(
        async (definitionId, number) => {
          await activate?.(definitionId, number)
          org.versions[1].id = '301colleague'
          org.versions[1].status = 'Obsolete'
          org.versions[0].status = 'Active'
          org.versions[0].id = '301other'
        }
      )

      // Act
      const error = await sut.evaluate(mutant('Active', 0)).catch(e => e)

      // Assert
      expect(error).toBeInstanceOf(FlowRevertError)
      expect(failuresOf(error)).toEqual([
        "Flow 'Account_After' has version 1 Active, which this run did not set: version 1 is not activated again",
        expect.stringContaining('versions changed unexpectedly'),
      ])
    })
  })

  describe('what a test run proves', () => {
    it.each([
      ['skipped', [{ methodName: 'Sets_Rating', outcome: 'Skip' }]],
      ['missing', []],
    ])(
      'Given the only FlowTest %s on a mutant run, When evaluated, Then it is an error, not a survivor, and the org is at rest',
      async (_label, tests) => {
        // Arrange
        const org = new FakeOrg(['Active'])
        const sut = build(org)
        await sut.prepare(source('Active'), hooks())
        org.runner.runFlowTests.mockResolvedValueOnce({
          outcome: 'Passed',
          tests,
        })

        // Act & Assert
        await expect(sut.evaluate(mutant('Active', 0))).rejects.toEqual(
          new FlowTestsNotRunError('Account_After', ['Sets_Rating'])
        )
        expect(org.state).toEqual([[1, 'Active']])
      }
    )

    it('Given two FlowTests and one missing from a run in which none failed, When evaluated, Then the missing one is named', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const second = flowTestXml('Account_After')
      org.flowTests.set('Test_1', second)
      const sut = build(org)
      await sut.prepare(source('Active', [ORIGINAL_TEST, second]), hooks())
      org.runner.runFlowTests.mockImplementationOnce(async () => {
        org.results.push({ id: '2hUx', versionNumber: 2, modstamp: 'x' })
        return {
          outcome: 'Passed',
          tests: [{ methodName: 'Sets_Rating', outcome: 'Pass' }],
        }
      })

      // Act & Assert
      await expect(sut.evaluate(mutant('Active', 0))).rejects.toEqual(
        new FlowTestsNotRunError('Account_After', ['Test_1'])
      )
    })

    it.each([['Fail'], ['CompileFail']])(
      'Given a FlowTest ending %s while another is missing, When evaluated, Then the mutant is killed by it',
      async outcome => {
        // Arrange
        const org = new FakeOrg(['Active'])
        const second = flowTestXml('Account_After')
        org.flowTests.set('Test_1', second)
        const sut = build(org)
        await sut.prepare(source('Active', [ORIGINAL_TEST, second]), hooks())
        org.runner.runFlowTests.mockImplementationOnce(async () => {
          org.results.push({ id: '2hUx', versionNumber: 2, modstamp: 'x' })
          return {
            outcome: 'Failed',
            tests: [{ methodName: 'Sets_Rating', outcome }],
          }
        })

        // Act & Assert
        await expect(sut.evaluate(mutant('Active', 0))).resolves.toEqual(KILLED)
      }
    )

    it('Given a baseline in which one FlowTest failed and another did not report, When prepared, Then testsRan counts the rows that came back', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const second = flowTestXml('Account_After')
      org.flowTests.set('Test_1', second)
      org.outcome = (_xml, test) => (test === 'Test_1' ? 'Fail' : 'Pass')
      const run = org.runner.runFlowTests.getMockImplementation()
      org.runner.runFlowTests.mockImplementationOnce(async (flow, names) => {
        const result = await (run as NonNullable<typeof run>)(flow, names)
        return { ...result, tests: result.tests.slice(1) }
      })
      const sut = build(org)

      // Act
      const baseline = await sut.prepare(
        source('Active', [ORIGINAL_TEST, second]),
        hooks()
      )

      // Assert
      expect(baseline.testsRan).toBe(1)
      expect(baseline.failingTests).toEqual(['Test_1'])
    })
  })

  describe('the org at rest', () => {
    it('Given a Draft whose original content did not land back, When restored, Then the marked version is reported', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Draft'])
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks())
      const deploy = org.metadata.deploy.getMockImplementation()
      org.metadata.deploy
        .mockImplementationOnce(async files => deploy?.(files))
        .mockImplementationOnce(async () => undefined)

      // Act
      const error = await sut.restore().catch(e => e)

      // Assert
      expect((error as FlowRestoreError).failures).toEqual([
        new FlowLeftoverVersionError('Account_After', [2]),
      ])
    })

    it('Given a version re-keyed by somebody else during the run, When restored, Then the restore fails naming it', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.versions[0].id = '301colleague'

      // Act
      const error = await sut.restore().catch(e => e)

      // Assert
      expect((error as FlowRestoreError).failures).toEqual([
        new FlowChangedOutsideRunError('Account_After', [1]),
      ])
    })
  })

  describe('a deploy whose outcome is unknown', () => {
    const notCompleted = (pending: boolean) =>
      new FlowDeployNotCompletedError('0Af1', 'InProgress', pending, 'timeout')

    it('Given a mutant deploy still pending, When evaluated, Then the run stops at once, and the restore waits for it and removes what it created', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.metadata.deploy.mockImplementationOnce(async files => {
        org.pendingLanding = () => org.save(files[0].xml)
        throw notCompleted(true)
      })
      org.activations = []
      org.deletes = []

      // Act
      const error = await sut.evaluate(mutant('Active', 0)).catch(e => e)
      const activationsBeforeRestore = [...org.activations]
      await sut.restore()

      // Assert
      expect(error).toBeInstanceOf(FlowOrgSafetyError)
      expect(activationsBeforeRestore).toEqual([])
      expect(org.metadata.awaitDeploy).toHaveBeenCalledWith('0Af1')
      expect(org.deletes).toEqual([2])
      expect(org.state).toEqual([[1, 'Active']])
    })

    it('Given a pending deploy that still does not finish, When restored, Then nothing else is attempted, and a later restore proceeds once it has', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Draft'])
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks())
      org.metadata.deploy.mockImplementationOnce(async files => {
        org.pendingLanding = () => org.save(files[0].xml)
        throw notCompleted(true)
      })
      await sut.evaluate(mutant('Draft', 0)).catch(() => undefined)
      org.metadata.awaitDeploy.mockRejectedValueOnce(notCompleted(true))
      org.metadata.deploy.mockClear()

      // Act
      const first = await sut.restore().catch(e => e)
      const deploysAfterFirst = org.metadata.deploy.mock.calls.length
      await sut.restore()

      // Assert
      expect(failuresOf(first)).toEqual([notCompleted(true).message])
      expect(deploysAfterFirst).toBe(0)
      expect(org.versions[1].xml).toBe(recordTriggeredFlowXml('Draft'))
      expect(org.flowTests.get('Sets_Rating')).toBe(ORIGINAL_TEST)
    })

    it('Given a deploy that did not complete and will not land, When restored, Then nothing is waited for', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.metadata.deploy.mockRejectedValueOnce(notCompleted(false))
      await sut.evaluate(mutant('Active', 0)).catch(() => undefined)

      // Act
      await sut.restore()

      // Assert
      expect(org.metadata.awaitDeploy).not.toHaveBeenCalled()
      expect(org.state).toEqual([[1, 'Active']])
    })

    it('Given the FlowTest deploy of the prepare still pending, When restored, Then the restore waits for it first', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const deploy = org.metadata.deploy.getMockImplementation()
      org.metadata.deploy.mockImplementationOnce(async files => {
        org.pendingLanding = () => {
          deploy?.(files)
        }
        throw notCompleted(true)
      })
      const sut = build(org)
      await sut.prepare(source('Active'), hooks()).catch(() => undefined)

      // Act
      await sut.restore()

      // Assert
      expect(org.metadata.awaitDeploy).toHaveBeenCalledWith('0Af1')
      expect(org.flowTests.get('Sets_Rating')).toBe(ORIGINAL_TEST)
    })
  })

  describe('the token of the run latest deploy', () => {
    it('Given a colleague saving a new version from an earlier temporary version while the next deploy is in flight, When evaluated, Then their copy, which carries the earlier marker, is not taken for the run own', async () => {
      // Arrange — Flow Builder copies the description, marker included
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      await sut.evaluate(mutant('Active', 0))
      const earlierMarker = /\[apex-mutation-testing\] run=[0-9a-f]{8}\.2/.exec(
        org.flowDeploys[1]
      )?.[0] as string
      const copy = withDescription(COLLEAGUE_XML, earlierMarker)
      const deploy = org.metadata.deploy.getMockImplementation()
      org.metadata.deploy.mockImplementationOnce(async files => {
        await deploy?.(files)
        org.createOnEveryDeploy = true
        org.save(copy)
        org.createOnEveryDeploy = false
      })
      org.deletes = []

      // Act
      const error = await sut.evaluate(mutant('Active', 1)).catch(e => e)

      // Assert
      expect(error).toBeInstanceOf(FlowOrgSafetyError)
      expect(org.deletes).toEqual([2])
      expect(org.versions.map(v => v.xml)).toContain(copy)
    })

    it('Given the listing after a mutant deploy failing in overwrite mode, When restored, Then the Draft carrying the run token is recognized and its original content deployed back', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Draft'])
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks())
      const list = org.versionRepository.listVersions.getMockImplementation()
      const real = async () => (list as NonNullable<typeof list>)()
      org.versionRepository.listVersions
        .mockImplementationOnce(real)
        .mockRejectedValueOnce(new Error('ECONNRESET'))

      // Act
      const error = await sut.evaluate(mutant('Draft', 0)).catch(e => e)
      await sut.restore()

      // Assert
      expect((error as Error).message).toBe('ECONNRESET')
      expect(org.versions[1].xml).toBe(recordTriggeredFlowXml('Draft'))
      expect(sut.needsRestore()).toBe(false)
    })
  })

  describe('what was written decides what is restored', () => {
    it('Given no FlowTest to detach and a colleague saving before the first deploy, When prepared, Then it refuses having written nothing, and the restore does nothing', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const unpinned = flowTestXml('Account_After')
      org.flowTests.set('Sets_Rating', unpinned)
      const list = org.versionRepository.listVersions.getMockImplementation()
      const real = async () => (list as NonNullable<typeof list>)()
      org.versionRepository.listVersions
        .mockImplementationOnce(real)
        .mockImplementationOnce(real)
        .mockImplementationOnce(async () => {
          org.createOnEveryDeploy = true
          org.save(COLLEAGUE_XML)
          org.createOnEveryDeploy = false
          return real()
        })
      const sut = build(org)

      // Act
      const error = await sut
        .prepare(source('Active', [unpinned]), hooks())
        .catch(e => e)
      await sut.restore()

      // Assert
      expect(error).toEqual(
        new FlowChangedOutsideRunError('Account_After', [2])
      )
      expect(sut.needsRestore()).toBe(false)
      expect(org.metadata.deploy).not.toHaveBeenCalled()
      expect(org.versions.map(v => v.xml)).toContain(COLLEAGUE_XML)
    })

    it('Given a deploy request failing before the org returned its id, When restored, Then every step still runs but the restore never reports success', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const unpinned = flowTestXml('Account_After')
      org.flowTests.set('Sets_Rating', unpinned)
      org.metadata.deploy.mockRejectedValueOnce(
        new FlowDeployNotCompletedError(undefined, 'Unknown', false, 'reset')
      )
      const sut = build(org)
      await sut
        .prepare(source('Active', [unpinned]), hooks())
        .catch(() => undefined)

      // Act
      const error = (await sut.restore().catch(e => e)) as FlowRestoreError

      // Assert
      expect(sut.needsRestore()).toBe(true)
      expect(error).toBeInstanceOf(FlowRestoreError)
      expect(error.failures).toHaveLength(1)
      expect(error.failures[0]).toBeInstanceOf(FlowDeployNotCompletedError)
      expect(error.failures[0].message).toContain('may still land')
      expect(org.state).toEqual([[1, 'Active']])
    })

    it('Given a deploy request failing before the org returned its id, When restored, Then the failure says a deploy of unknown id may still land', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const unpinned = flowTestXml('Account_After')
      org.flowTests.set('Sets_Rating', unpinned)
      org.metadata.deploy.mockRejectedValueOnce(
        new FlowDeployNotCompletedError(undefined, 'Unknown', false, 'reset')
      )
      const sut = build(org)
      await sut
        .prepare(source('Active', [unpinned]), hooks())
        .catch(() => undefined)

      // Act
      const error = (await sut.restore().catch(e => e)) as FlowRestoreError

      // Assert
      expect(error.failures).toEqual([
        new FlowDeployNotCompletedError(
          undefined,
          'Unknown',
          true,
          'a deploy request of the run failed before the org returned its id, and may still land'
        ),
      ])
    })

    it('Given no deploy issued yet and a colleague version whose description reads "undefined", When the first check refuses, Then the restore never takes it for the run own', async () => {
      // Arrange — before the first flow deploy there is no deploy marker
      const org = new FakeOrg(['Active'])
      const colleague = withDescription(COLLEAGUE_XML, 'undefined')
      const list = org.versionRepository.listVersions.getMockImplementation()
      const real = async () => (list as NonNullable<typeof list>)()
      org.versionRepository.listVersions
        .mockImplementationOnce(real)
        .mockImplementationOnce(real)
        .mockImplementationOnce(async () => {
          org.createOnEveryDeploy = true
          org.save(colleague)
          org.createOnEveryDeploy = false
          return real()
        })
      const sut = build(org)
      await sut.prepare(source('Active'), hooks()).catch(() => undefined)

      // Act
      await sut.restore().catch(() => undefined)

      // Assert
      expect(org.deletes).toEqual([])
      expect(org.versions.map(v => v.xml)).toContain(colleague)
    })
  })

  describe('mutants of the test bed', () => {
    it('Given a source to read again, When prepared, Then exactly the flow and its selected FlowTests are retrieved', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)

      // Act
      await sut.prepare(source('Active'), hooks())

      // Assert
      expect(org.metadata.retrieve).toHaveBeenNthCalledWith(1, [
        { type: 'Flow', fullNames: ['Account_After'] },
        { type: 'FlowTest', fullNames: ['Sets_Rating'] },
      ])
    })

    it('Given a retrieve listing the FlowTests before the flow, When prepared, Then the flow is still found among them', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const retrieve = org.metadata.retrieve.getMockImplementation()
      org.metadata.retrieve.mockImplementationOnce(async members =>
        [
          ...(await (retrieve as NonNullable<typeof retrieve>)(members)),
        ].reverse()
      )
      const sut = build(org)

      // Act & Assert
      await expect(
        sut.prepare(source('Active'), hooks())
      ).resolves.toBeDefined()
    })

    it('Given a FlowTest named like its flow, When prepared, Then the FlowTest, not the flow, is compared with it', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const test = flowTestXml('Account_After')
      org.flowTests = new Map([['Account_After', test]])
      const sut = build(org)

      // Act & Assert
      await expect(
        sut.prepare(
          {
            apiName: 'Account_After',
            xml: recordTriggeredFlowXml('Active'),
            tests: [{ fullName: 'Account_After', xml: test }],
          },
          hooks()
        )
      ).resolves.toBeDefined()
    })

    it.each([
      ['Active', ['Active']],
      ['Draft', ['Obsolete', 'Draft']],
    ])(
      'Given a %s original and a mutant deploy still pending, When evaluated, Then nothing more is read before the run stops',
      async (status, statuses) => {
        // Arrange
        const org = new FakeOrg(statuses)
        const sut = build(org)
        await sut.prepare(source(status), hooks())
        org.metadata.deploy.mockRejectedValueOnce(
          new FlowDeployNotCompletedError('0Af1', 'InProgress', true, 'slow')
        )
        org.versionRepository.listVersions.mockClear()

        // Act
        const error = await sut.evaluate(mutant(status, 0)).catch(e => e)

        // Assert
        expect(error).toBeInstanceOf(FlowDeployNotCompletedError)
        // the check before the write, and nothing after it
        expect(org.versionRepository.listVersions).toHaveBeenCalledTimes(1)
      }
    )

    it('Given the temporary version deleted right before its activation, When evaluated, Then it is not activated and the run stops', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      const list = org.versionRepository.listVersions.getMockImplementation()
      const real = async () => (list as NonNullable<typeof list>)()
      org.versionRepository.listVersions
        .mockImplementationOnce(real)
        .mockImplementationOnce(real)
        .mockImplementationOnce(async () => {
          org.versions.pop()
          return real()
        })
      org.activations = []

      // Act
      const error = await sut.evaluate(mutant('Active', 0)).catch(e => e)

      // Assert
      expect(error).toEqual(
        new FlowChangedOutsideRunError('Account_After', [2])
      )
      expect(org.activations).toEqual([])
    })

    it('Given the temporary version deleted right after its activation, When evaluated, Then the guard stops the run', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      const activate =
        org.versionRepository.activateVersion.getMockImplementation()
      org.versionRepository.activateVersion.mockImplementationOnce(
        async (definitionId, number) => {
          await activate?.(definitionId, number)
          org.versions.pop()
        }
      )

      // Act
      const error = await sut.evaluate(mutant('Active', 0)).catch(e => e)

      // Assert
      expect(error).toBeInstanceOf(FlowRevertError)
      expect(failuresOf(error)[1]).toBe(
        "Flow 'Account_After' versions changed unexpectedly during the run"
      )
    })

    it('Given a FlowTest a colleague edited during the run, When restored, Then no FlowTest is deployed at all', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.flowTests.set('Sets_Rating', flowTestXml('Account_After', [9]))
      org.metadata.deploy.mockClear()

      // Act
      const error = (await sut.restore().catch(e => e)) as FlowRestoreError

      // Assert
      expect(error.failures[0]).toBeInstanceOf(FlowTestChangedOutsideRunError)
      expect(org.metadata.deploy).not.toHaveBeenCalled()
    })

    it('Given a FlowTest read back with only some of its versions, When restored, Then the restore reports the difference', async () => {
      // Arrange
      const original = flowTestXml('Account_After', [1, 2])
      const org = new FakeOrg(['Obsolete', 'Active'])
      org.flowTests.set('Sets_Rating', original)
      const sut = build(org)
      await sut.prepare(source('Active', [original]), hooks())
      org.metadata.deploy.mockImplementationOnce(async () => {
        org.flowTests.set('Sets_Rating', flowTestXml('Account_After', [1, 3]))
      })

      // Act
      const error = (await sut.restore().catch(e => e)) as FlowRestoreError

      // Assert
      expect(error.failures).toEqual([
        new FlowTestRestorePinError('Sets_Rating', [1, 2], [1, 3]),
      ])
    })

    it('Given the FlowTest deploy of the prepare pending and the org storing it in another spelling, When restored, Then what landed is read back and the FlowTest put back', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      org.normalizeFlowTests = true
      const deploy = org.metadata.deploy.getMockImplementation()
      org.metadata.deploy.mockImplementationOnce(async files => {
        org.pendingLanding = () => {
          deploy?.(files)
        }
        throw new FlowDeployNotCompletedError('0Af1', 'InProgress', true, 'x')
      })
      const sut = build(org)
      await sut.prepare(source('Active'), hooks()).catch(() => undefined)

      // Act
      await sut.restore()

      // Assert
      expect(
        pinnedVersions(org.flowTests.get('Sets_Rating') as string)
      ).toEqual([1])
      expect(sut.needsRestore()).toBe(false)
    })

    it('Given a pending mutant deploy and a colleague editing a FlowTest while it lands, When restored, Then the read-back taken earlier still decides, and their edit is kept', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      const edited = flowTestXml('Account_After', [7])
      org.metadata.deploy.mockImplementationOnce(async files => {
        org.pendingLanding = () => {
          org.save(files[0].xml)
          org.flowTests.set('Sets_Rating', edited)
        }
        throw new FlowDeployNotCompletedError('0Af1', 'InProgress', true, 'x')
      })
      await sut.evaluate(mutant('Active', 0)).catch(() => undefined)
      org.metadata.retrieve.mockClear()

      // Act
      const error = (await sut.restore().catch(e => e)) as FlowRestoreError

      // Assert
      expect(org.flowTests.get('Sets_Rating')).toBe(edited)
      expect(error.failures[0]).toBeInstanceOf(FlowTestChangedOutsideRunError)
      expect(org.metadata.retrieve).not.toHaveBeenCalledWith([
        { type: 'FlowTest', fullNames: [] },
      ])
    })

    it('Given the original Active version re-keyed at rest in activate mode, When restored, Then that change is reported too', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.versions[0].id = '301rekeyed'

      // Act
      const error = (await sut.restore().catch(e => e)) as FlowRestoreError

      // Assert
      expect(error.failures.map(f => f.message)).toEqual([
        "Flow 'Account_After' has version 1 Active, which this run did not set: version 1 is not activated again",
        "Flow 'Account_After' was changed outside the run (versions 1)",
      ])
    })
  })

  describe('only the reading that follows a deploy attributes versions', () => {
    it('Given a colleague saving over the Draft the run deployed, its marker copied, When the next mutant is evaluated, Then their save is not adopted, the run stops and the restore leaves it', async () => {
      // Arrange — Flow Builder keeps the description, latest token included
      const org = new FakeOrg(['Obsolete', 'Draft'])
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks())
      await sut.evaluate(mutant('Draft', 0))
      const theirs = org.versions[1].xml.replace('Update0', 'Delete')
      org.save(theirs)
      org.flowDeploys = []

      // Act
      const error = await sut.evaluate(mutant('Draft', 1)).catch(e => e)
      const restoreError = await sut.restore().catch(e => e)

      // Assert
      expect(error).toEqual(
        new FlowChangedOutsideRunError('Account_After', [2])
      )
      expect(org.flowDeploys).toEqual([])
      expect(org.versions[1].xml).toBe(theirs)
      expect(restoreError).toBeInstanceOf(FlowRestoreError)
    })

    it('Given a colleague saving a new version from the temporary one while its tests run, When evaluated, Then their copy, latest token included, is not deleted', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      const run = org.runner.runFlowTests.getMockImplementation()
      let copy = ''
      org.runner.runFlowTests.mockImplementationOnce(async (flow, tests) => {
        copy = (org.versions.at(-1) as FakeVersion).xml.replace(
          'Update0',
          'Delete'
        )
        org.createOnEveryDeploy = true
        org.save(copy)
        org.createOnEveryDeploy = false
        return (run as NonNullable<typeof run>)(flow, tests)
      })
      org.deletes = []

      // Act
      const error = await sut.evaluate(mutant('Active', 0)).catch(e => e)

      // Assert
      expect(error).toBeInstanceOf(FlowRevertError)
      expect(org.deletes).toEqual([2])
      expect(org.versions.map(v => v.xml)).toContain(copy)
    })
  })

  describe('details of a test run and of the restore', () => {
    it('Given the runner spelling a FlowTest name in another case, When the baseline passes, Then it counts as run', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const run = org.runner.runFlowTests.getMockImplementation()
      org.runner.runFlowTests.mockImplementation(async (flow, tests) => {
        const result = await (run as NonNullable<typeof run>)(flow, tests)
        return {
          ...result,
          tests: result.tests.map(test => ({
            ...test,
            methodName: test.methodName.toUpperCase(),
          })),
        }
      })
      org.outcome = () => 'Pass'
      const sut = build(org)

      // Act & Assert
      await expect(sut.prepare(source('Active'), hooks())).resolves.toEqual(
        expect.objectContaining({ testsRan: 1, failingTests: [] })
      )
    })

    it('Given a Draft original, When restored, Then the restore deploys are never cancelled on a timeout, unlike the evaluation deploys', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Draft'])
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks())
      await sut.evaluate(mutant('Draft', 0))
      org.metadata.deploy.mockClear()

      // Act
      await sut.restore()

      // Assert — the FlowTests, then the Draft's original content
      expect(
        org.metadata.deploy.mock.calls.map(([, cancel]) => cancel)
      ).toEqual([false, false])
    })

    it('Given an evaluation deploy, When evaluated, Then it may be cancelled on a timeout', async () => {
      // Arrange
      const org = new FakeOrg(['Obsolete', 'Draft'])
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks())
      org.metadata.deploy.mockClear()

      // Act
      await sut.evaluate(mutant('Draft', 0))

      // Assert
      expect(org.metadata.deploy).toHaveBeenCalledWith(expect.any(Array), true)
    })

    it('Given a Draft original never deployed by the run, When a colleague saved over it and the run is restored, Then the change is reported', async () => {
      // Arrange — the FlowTests come back still pinned: no flow deploy happens
      const org = new FakeOrg(['Obsolete', 'Draft'])
      org.keepPinsOnDeploy = true
      const sut = build(org)
      await sut.prepare(source('Draft'), hooks()).catch(() => undefined)
      org.keepPinsOnDeploy = false
      org.save(COLLEAGUE_XML)

      // Act
      const error = (await sut.restore().catch(e => e)) as FlowRestoreError

      // Assert
      expect(org.flowDeploys).toEqual([])
      expect(error.failures.map(f => f.message)).toEqual([
        "Flow 'Account_After' was changed outside the run (versions 2)",
      ])
    })
  })
})
