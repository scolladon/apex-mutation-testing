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
  FlowDeployFailedError,
  FlowDraftBesideActiveError,
  FlowRestoreError,
  FlowRevertError,
  FlowTestPinError,
  FlowTestRepinFailedError,
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

interface FakeVersion extends FlowVersionRow {
  xml: string
}

const ORIGINAL_TEST = flowTestXml('Account_After', [1])

// An in-memory org reproducing what a sandbox showed: a deploy while the
// latest version is a Draft overwrites it in place (re-keying its record),
// any other deploy creates a new Draft numbered after the highest; an
// activation makes the previously Active version Obsolete; and the test
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

  readonly metadata = {
    deploy: vi.fn(async (files: FlowMetadataFile[]) => {
      for (const file of files) {
        if (file.type === 'FlowTest') {
          if (this.refuseFlowTests) {
            throw new FlowDeployFailedError(['bad test'])
          }
          if (!this.keepPinsOnDeploy) {
            this.flowTests.set(file.fullName, file.xml)
          }
          continue
        }
        if (this.refuseFlow?.(file.xml)) {
          throw new FlowDeployFailedError(['Element invalid'])
        }
        this.flowDeploys.push(file.xml)
        const latest = this.versions.at(-1)
        const overwrite =
          this.overwriteOnEveryDeploy ||
          (latest?.status === 'Draft' && !this.createOnEveryDeploy)
        if (overwrite && latest) {
          latest.id = `301${this.nextId++}`
          latest.xml = file.xml
          if (this.renumberOnOverwrite) latest.versionNumber += 10
          continue
        }
        this.create(file.xml)
        if (this.createTwice) this.create(file.xml)
      }
      if (this.dropLatestOnDeploy) this.versions.pop()
    }),
    retrieve: vi.fn(async (members: { type: string; fullNames: string[] }[]) =>
      members[0].fullNames
        .filter(fullName => this.flowTests.has(fullName))
        .map(fullName => ({
          type: 'FlowTest' as const,
          fullName,
          xml: this.flowTests.get(fullName) as string,
        }))
    ),
  }

  readonly versionRepository = {
    readDefinitionId: vi.fn(async () => '300X'),
    // ordered by version number, as the Tooling query is
    listVersions: vi.fn(async () =>
      this.versions
        .map(({ id, versionNumber, status }) => ({
          id,
          versionNumber,
          status,
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
      expect(org.flowDeploys[0]).toContain(
        `<description>${TEMPORARY_VERSION_MARKER}</description>`
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

    it('Given a Draft latest version with no Active one, When prepared, Then it is overwritten in place, unmarked, and nothing is activated', async () => {
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
      expect(org.versions[1].xml).toBe(recordTriggeredFlowXml('Draft'))
      expect(org.activations).toEqual([])
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
      org.metadata.retrieve.mockResolvedValueOnce([
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

    it('Given FlowTests with no pin, When prepared and restored, Then no FlowTest is deployed or read back', async () => {
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
      expect(org.metadata.retrieve).not.toHaveBeenCalled()
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
      await expect(sut.prepare(source('Draft'), hooks())).rejects.toThrow(
        "No FlowTest of 'Account_After' ran (outcome: Failed)"
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
        'the original overwritten instead of a version created',
        (org: FakeOrg) => {
          org.overwriteOnEveryDeploy = true
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
        'the original no longer Active',
        (org: FakeOrg) => {
          const deploy = org.metadata.deploy.getMockImplementation()
          org.metadata.deploy.mockImplementationOnce(async files => {
            await deploy?.(files)
            org.versions[0].status = 'Obsolete'
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

      // Act & Assert
      await expect(sut.evaluate(mutant('Active', 0))).rejects.toEqual(
        new FlowRevertError('Account_After', [
          'Deployment failed: cannot activate',
        ])
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

        // Act & Assert
        await expect(sut.evaluate(mutant('Active', 0))).rejects.toEqual(
          new FlowRevertError('Account_After', ['paused interview', text])
        )
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
      // Arrange — an interruption between an activation and its revert
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.versions[0].status = 'Obsolete'
      org.versions.push({
        id: '301t',
        versionNumber: 2,
        status: 'Active',
        xml: mutant('Draft', 0),
      })
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
      org.versions.push({
        id: '301t',
        versionNumber: 2,
        status: 'Draft',
        xml: '',
      })
      org.failDelete = true

      // Act
      const error = await sut.restore().catch((e: unknown) => e)

      // Assert
      expect(error).toBeInstanceOf(FlowRestoreError)
      expect((error as FlowRestoreError).failures.map(f => f.message)).toEqual([
        'paused interview',
        "Flow 'Account_After' versions changed unexpectedly during the run",
      ])
      expect(org.flowTests.get('Sets_Rating')).toBe(ORIGINAL_TEST)
    })

    it('Given an extra version Active and the original refusing activation, When restored, Then the extra version is never deleted and the restore fails', async () => {
      // Arrange
      const org = new FakeOrg(['Active'])
      const sut = build(org)
      await sut.prepare(source('Active'), hooks())
      org.versions[0].status = 'Obsolete'
      org.versions.push({
        id: '301t',
        versionNumber: 2,
        status: 'Active',
        xml: '',
      })
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
        "Flow 'Account_After' versions changed unexpectedly during the run",
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
})
