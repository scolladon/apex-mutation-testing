import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Messages } from '@salesforce/core'
import { createOrgFlowEngine } from '../../../../../../src/adapter/org/orgEngine.js'
import FlowMutationRun from '../../../../../../src/commands/apex/mutation/flow/run.js'
import { FlowMutationOrchestrator } from '../../../../../../src/flow/FlowMutationOrchestrator.js'
import type { FlowMutant } from '../../../../../../src/flow/types.js'
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
} from '../../../../../../src/port/flowErrors.js'
import { FlowHTMLReporter } from '../../../../../../src/reporter/FlowHTMLReporter.js'

vi.mock('@salesforce/sf-plugins-core', () => {
  class FakeSfCommand {
    progress = {
      start: vi.fn(),
      update: vi.fn(),
      finish: vi.fn(),
      stop: vi.fn(),
    }
    spinner = { start: vi.fn(), stop: vi.fn(), pause: vi.fn() }
    log = vi.fn()
    info = vi.fn()
    warn = vi.fn()
    parse = vi.fn()
  }
  return {
    SfCommand: FakeSfCommand,
    Flags: {
      string: vi.fn(options => options),
      boolean: vi.fn(options => options),
      directory: vi.fn(options => options),
      file: vi.fn(options => options),
      integer: vi.fn(options => options),
      requiredOrg: vi.fn().mockReturnValue({ org: true }),
      orgApiVersion: vi.fn().mockReturnValue({ apiVersion: true }),
    },
  }
})
vi.mock('../../../../../../src/adapter/org/orgEngine.js', () => ({
  createOrgFlowEngine: vi.fn(),
}))
vi.mock('../../../../../../src/flow/FlowMutationOrchestrator.js', () => ({
  FlowMutationOrchestrator: vi.fn(),
}))
vi.mock('../../../../../../src/reporter/FlowHTMLReporter.js', () => ({
  FlowHTMLReporter: vi.fn(),
}))

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.flow.run'
)

const statusMutant = (status: FlowMutant['status']) =>
  ({ status }) as FlowMutant

describe('apex mutation flow run', () => {
  const orchestratorRun = vi.fn()
  const generateReport = vi.fn()
  const getConnection = vi.fn().mockReturnValue({ conn: true })
  let sut: FlowMutationRun & {
    parse: ReturnType<typeof vi.fn>
    log: ReturnType<typeof vi.fn>
    info: ReturnType<typeof vi.fn>
    warn: ReturnType<typeof vi.fn>
    spinner: { pause: ReturnType<typeof vi.fn> }
  }

  const flags = (overrides: Record<string, unknown> = {}) => ({
    flow: 'Account_After',
    'report-dir': 'mutations',
    'dry-run': false,
    'target-org': { getConnection },
    'api-version': '66.0',
    ...overrides,
  })

  const runWith = (overrides: Record<string, unknown>) => {
    sut.parse.mockResolvedValue({ flags: flags(overrides) })
    return sut.run()
  }

  beforeEach(() => {
    vi.mocked(createOrgFlowEngine).mockResolvedValue({
      source: { readFlow: vi.fn() },
      testBed: {
        prepare: vi.fn(),
        evaluate: vi.fn(),
        needsRestore: vi.fn(),
        restore: vi.fn(),
      },
    })
    vi.mocked(FlowMutationOrchestrator).mockImplementation(
      class {
        run = orchestratorRun
      } as unknown as typeof FlowMutationOrchestrator
    )
    vi.mocked(FlowHTMLReporter).mockImplementation(
      class {
        generateReport = generateReport
      } as unknown as typeof FlowHTMLReporter
    )
    orchestratorRun.mockResolvedValue({
      flowApiName: 'Account_After',
      sourceXml: '<Flow/>',
      testNames: ['Sets_Rating'],
      mutants: [
        statusMutant('Killed'),
        statusMutant('Killed'),
        statusMutant('Survived'),
      ],
    })
    sut = new (FlowMutationRun as unknown as new () => typeof sut)()
    sut.parse.mockResolvedValue({ flags: flags() })
  })

  describe('declaration', () => {
    const declared = FlowMutationRun.flags as unknown as Record<
      string,
      Record<string, unknown>
    >

    it('Given the declaration, When read, Then every flag mirrors the Apex command, its summary from the bundle', () => {
      // Assert
      expect(declared).toEqual({
        flow: {
          char: 'f',
          summary: messages.getMessage('flags.flow.summary'),
          required: true,
        },
        'flow-test': {
          char: 't',
          summary: messages.getMessage('flags.flow-test.summary'),
          multiple: true,
          delimiter: ',',
        },
        'report-dir': {
          char: 'r',
          summary: messages.getMessage('flags.report-dir.summary'),
          exists: true,
          default: 'mutations',
        },
        'dry-run': {
          char: 'd',
          summary: messages.getMessage('flags.dry-run.summary'),
          default: false,
        },
        'include-mutators': {
          summary: messages.getMessage('flags.include-mutators.summary'),
          exclusive: ['exclude-mutators'],
          multiple: true,
        },
        'exclude-mutators': {
          summary: messages.getMessage('flags.exclude-mutators.summary'),
          exclusive: ['include-mutators'],
          multiple: true,
        },
        lines: {
          char: 'l',
          summary: messages.getMessage('flags.lines.summary'),
          multiple: true,
        },
        threshold: {
          summary: messages.getMessage('flags.threshold.summary'),
          min: 0,
          max: 100,
        },
        'config-file': {
          summary: messages.getMessage('flags.config-file.summary'),
          exists: true,
        },
        'target-org': { org: true },
        'api-version': { apiVersion: true },
      })
    })

    it('Given the declaration, When read, Then summary, description and examples come from the bundle', () => {
      // Assert
      expect(FlowMutationRun.summary).toBe(messages.getMessage('summary'))
      expect(FlowMutationRun.description).toBe(
        messages.getMessage('description')
      )
      expect(FlowMutationRun.examples).toEqual(messages.getMessages('examples'))
      expect(FlowMutationRun.examples.length).toBeGreaterThan(0)
    })

    it('Given the declaration, When read, Then the command is marked beta', () => {
      // Assert
      expect(FlowMutationRun.state).toBe('beta')
    })
  })

  describe('run', () => {
    it('Given a run, When it completes, Then the engine is built on the requested API version and the score is returned unrounded as the only JSON field', async () => {
      // Act
      const result = await sut.run()

      // Assert
      expect(getConnection).toHaveBeenCalledWith('66.0')
      expect(createOrgFlowEngine).toHaveBeenCalledWith({
        connection: { conn: true },
        notify: expect.any(Function),
      })
      expect(orchestratorRun).toHaveBeenCalledWith({
        flowApiName: 'Account_After',
        flowTestNames: undefined,
        lines: undefined,
        includeMutators: undefined,
        excludeMutators: undefined,
        dryRun: false,
      })
      expect(result).toEqual({ score: (2 / 3) * 100 })
      expect(sut.log).toHaveBeenCalledWith(`Mutation score: ${(2 / 3) * 100}%`)
      expect(sut.log).toHaveBeenCalledWith(
        'Running mutation testing for Flow "Account_After" with all of its FlowTests'
      )
      expect(sut.log).toHaveBeenCalledWith(
        'Report has been generated at this location: mutations'
      )
      expect(sut.info).toHaveBeenCalledWith(
        expect.stringContaining('Enjoying apex-mutation-testing?')
      )
    })

    it('Given flow tests, lines and mutator flags, When run, Then they are trimmed and passed through', async () => {
      // Act
      await runWith({
        flow: ' Account_After ',
        'flow-test': [' Sets_Rating', 'Account_After.Keeps'],
        lines: ['1-5'],
        'include-mutators': ['DecisionOperator'],
      })

      // Assert
      expect(orchestratorRun).toHaveBeenCalledWith({
        flowApiName: 'Account_After',
        flowTestNames: ['Sets_Rating', 'Account_After.Keeps'],
        lines: ['1-5'],
        includeMutators: ['DecisionOperator'],
        excludeMutators: undefined,
        dryRun: false,
      })
      expect(sut.log).toHaveBeenCalledWith(
        'Running mutation testing for Flow "Account_After" with FlowTest(s) "Sets_Rating, Account_After.Keeps"'
      )
    })

    it.each([
      [
        undefined,
        'Running dry run mutation testing for Flow "Account_After" with all of its FlowTests',
      ],
      [
        ['Sets_Rating'],
        'Running dry run mutation testing for Flow "Account_After" with FlowTest(s) "Sets_Rating"',
      ],
    ])(
      'Given a dry run with FlowTests %j, When run, Then no score is computed nor logged',
      async (flowTests, running) => {
        // Act
        const result = await runWith({
          'dry-run': true,
          threshold: 100,
          'flow-test': flowTests,
        })

        // Assert
        expect(result).toEqual({ score: null })
        expect(sut.log).toHaveBeenCalledWith(running)
        expect(sut.log).not.toHaveBeenCalledWith(
          expect.stringContaining('Mutation score')
        )
      }
    )

    it('Given a score below the threshold, When run, Then it fails with the shared threshold message after the report', async () => {
      // Act & Assert
      await expect(runWith({ threshold: 67 })).rejects.toThrow(
        `Mutation score ${(2 / 3) * 100}% is below the required threshold of 67%`
      )
      expect(generateReport).toHaveBeenCalled()
    })

    it.each([[66], [0]])(
      'Given a score above the threshold %s, When run, Then it succeeds',
      async threshold => {
        // Act & Assert
        await expect(runWith({ threshold })).resolves.toEqual({
          score: (2 / 3) * 100,
        })
      }
    )

    it('Given a score equal to the threshold, When run, Then it succeeds', async () => {
      // Arrange
      orchestratorRun.mockResolvedValue({
        flowApiName: 'Account_After',
        sourceXml: '<Flow/>',
        testNames: [],
        mutants: [statusMutant('Killed'), statusMutant('Survived')],
      })

      // Act & Assert
      await expect(runWith({ threshold: 50 })).resolves.toEqual({ score: 50 })
    })

    it('Given an engine notice, When reported, Then it goes through the spinner', async () => {
      // Arrange
      await sut.run()
      const { notify } = vi.mocked(createOrgFlowEngine).mock.calls[0][0]

      // Act
      notify({ kind: 'sync-transport-fallback', error: new Error('x') })

      // Assert
      expect(sut.spinner.pause).toHaveBeenCalled()
    })
  })

  describe('configuration file', () => {
    let dir: string
    const configFile = async (content: unknown) => {
      const file = path.join(dir, 'config.json')
      await writeFile(file, JSON.stringify(content))
      return file
    }

    beforeEach(async () => {
      dir = await mkdtemp(path.join(tmpdir(), 'flow-run-config-'))
    })

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true })
    })

    it('Given a flow section, When run, Then its mutators and threshold apply', async () => {
      // Arrange
      const file = await configFile({
        mutators: { include: ['ArithmeticOperator'] },
        flow: { mutators: { exclude: ['ConnectorBypass'] }, threshold: 90 },
      })

      // Act & Assert
      await expect(runWith({ 'config-file': file })).rejects.toThrow(
        'below the required threshold of 90%'
      )
      expect(orchestratorRun).toHaveBeenCalledWith(
        expect.objectContaining({
          includeMutators: undefined,
          excludeMutators: ['ConnectorBypass'],
        })
      )
    })

    it('Given only a top-level threshold, When run, Then it is the default', async () => {
      // Arrange
      const file = await configFile({ threshold: 80 })

      // Act & Assert
      await expect(runWith({ 'config-file': file })).rejects.toThrow(
        'below the required threshold of 80%'
      )
    })

    it('Given --exclude-mutators, When run, Then the list reaches the orchestrator', async () => {
      // Act
      await runWith({ 'exclude-mutators': ['ConnectorBypass'] })

      // Assert
      expect(orchestratorRun).toHaveBeenCalledWith(
        expect.objectContaining({
          includeMutators: undefined,
          excludeMutators: ['ConnectorBypass'],
        })
      )
    })

    it('Given flags and a config file, When run, Then the flags win', async () => {
      // Arrange
      const file = await configFile({
        flow: { mutators: { include: ['AssignmentMutator'] }, threshold: 90 },
      })

      // Act
      const result = await runWith({
        'config-file': file,
        'include-mutators': ['DecisionOperator'],
        threshold: 10,
      })

      // Assert
      expect(result).toEqual({ score: (2 / 3) * 100 })
      expect(orchestratorRun).toHaveBeenCalledWith(
        expect.objectContaining({ includeMutators: ['DecisionOperator'] })
      )
    })

    it('Given a malformed flow section, When run, Then it is refused before any org call', async () => {
      // Arrange
      const file = await configFile({ flow: { threshold: 'high' } })

      // Act & Assert
      await expect(runWith({ 'config-file': file })).rejects.toThrow(
        `Invalid 'flow.threshold' in config file '${file}': expected a number, found string.`
      )
      expect(createOrgFlowEngine).not.toHaveBeenCalled()
    })
  })

  describe('name validation', () => {
    it.each([['1Flow'], ['Flow-Name'], ["Fl'ow"], ['_Flow']])(
      'Given the flow name %s, When run, Then it is rejected before any org call',
      async flow => {
        // Act & Assert
        await expect(runWith({ flow })).rejects.toThrow(
          `Invalid Flow API name: '${flow}'`
        )
        expect(createOrgFlowEngine).not.toHaveBeenCalled()
      }
    )

    it.each([
      ["T'1"],
      ['1Test'],
      ['_Test'],
      ['Account_After.'],
      ['Account_After..Test'],
      ['.Test'],
    ])(
      'Given the test name %s, When run, Then it is rejected before any org call',
      async name => {
        // Act & Assert
        await expect(runWith({ 'flow-test': [name] })).rejects.toThrow(
          `Invalid FlowTest name: '${name}'`
        )
        expect(createOrgFlowEngine).not.toHaveBeenCalled()
      }
    )

    it('Given FlowTest names in every accepted form, When run, Then they pass', async () => {
      // Act
      await runWith({
        'flow-test': [
          'Sets_Rating',
          'Account_After.Sets_Rating',
          'FlowTesting.Account_After.Sets_Rating',
        ],
      })

      // Assert
      expect(orchestratorRun).toHaveBeenCalled()
    })

    it('Given an empty FlowTest entry, When run, Then it is rejected with its own message', async () => {
      // Act & Assert
      await expect(runWith({ 'flow-test': ['A', ' '] })).rejects.toThrow(
        messages.getMessage('error.blankFlowTest')
      )
      expect(createOrgFlowEngine).not.toHaveBeenCalled()
    })
  })

  describe('error rendering', () => {
    it('Given a production org, When run, Then the message is exactly the bundle text, with no token appended', async () => {
      // Arrange
      vi.mocked(createOrgFlowEngine).mockRejectedValue(new ProductionOrgError())

      // Act
      const error = (await sut.run().catch(e => e)) as Error

      // Assert
      expect(error.message).toBe(messages.getMessage('error.productionOrg'))
    })

    it.each<[string, Error, string]>([
      [
        'production',
        new ProductionOrgError(),
        'The target org is not a sandbox, a scratch org or a Developer Edition org.',
      ],
      [
        'namespaced',
        new FlowNamespacedOrgError('ns\u0007'),
        "The target org has the namespace prefix 'ns'. FlowTests cannot be run by name",
      ],
      [
        'API version',
        new FlowApiVersionTooLowError('65.0', '66.0'),
        'requires API version 66.0 or later, but the connection uses 65.0. Pass --api-version 66.0 or later.',
      ],
    ])(
      'Given the engine refuses (%s), When run, Then the bundle message is shown',
      async (_label, error, message) => {
        // Arrange
        vi.mocked(createOrgFlowEngine).mockRejectedValue(error)

        // Act & Assert
        await expect(sut.run()).rejects.toThrow(message)
        expect(orchestratorRun).not.toHaveBeenCalled()
      }
    )

    it('Given the engine fails for another reason, When run, Then it is rethrown untouched', async () => {
      // Arrange
      const failure = new Error('INVALID_SESSION_ID')
      vi.mocked(createOrgFlowEngine).mockRejectedValue(failure)

      // Act & Assert
      await expect(sut.run()).rejects.toBe(failure)
    })

    it.each<[Error, string]>([
      [
        new FlowNotFoundError('F'),
        "Flow 'F' was not found on the target org. Pass the Flow's API name, not its label",
      ],
      [new FlowAmbiguousError('F', 2), "Flow 'F' matches 2 flow definitions"],
      [
        new NoFlowTestsError('F'),
        "Flow 'F' has no FlowTest on the target org.",
      ],
      [
        new FlowTestNotFoundError('F', ['A', 'B\u0007']),
        "FlowTest(s) not found for Flow 'F': A, B. Flow Builder lists",
      ],
      [
        new UnsupportedFlowVersionStateError('F', 'In\u0007active'),
        "The latest version of Flow 'F' has status 'In active'.",
      ],
      [
        new FlowDraftBesideActiveError('F', 3, 2),
        "The latest version of Flow 'F' (version 3) is a Draft beside the Active version 2.",
      ],
      [
        new FlowLeftoverVersionError('F', [2, 3]),
        "Flow 'F' has versions marked [apex-mutation-testing] (2, 3): an interrupted run of this command left them",
      ],
      [
        new FlowLeftoverVersionError('F', []),
        "Flow 'F' has versions marked [apex-mutation-testing] (-)",
      ],
      [
        new FlowTestLeftoverError('F', 'T\u0007', [1, 4]),
        "FlowTest 'T' of Flow 'F' carries the [apex-mutation-testing] marker: an interrupted run of this command detached it from its flow versions. Before running again, associate it again with the versions it had (1, 4)",
      ],
      [
        new FlowChangedOutsideRunError('F', [1, 2]),
        "Flow 'F' was changed outside this run (versions 1, 2)",
      ],
      [
        new FlowChangedOutsideRunError('F', [2], true),
        "Flow 'F' changed while the run was reading it (versions 2). Nothing was written to the org; run again.",
      ],
      [
        new FlowTestChangedOutsideRunError(['A', 'B\u0007']),
        'FlowTests not restored, because they no longer hold what this run left in them (changed or deleted outside the run), or that could not be confirmed: A, B.',
      ],
      [
        new FlowTestChangedOutsideRunError(['A'], true),
        'FlowTests changed while the run was reading them: A. Nothing was written to the org; run again.',
      ],
      [
        new FlowVersionLimitError('F', 50, 50),
        "Flow 'F' already has 50 versions, the maximum of 50.",
      ],
      [
        new FlowVersionGuardError(
          'F',
          { numbers: [1, 2], active: 2 },
          { numbers: [1, 2, 3], active: 3 }
        ),
        "The versions of Flow 'F' changed unexpectedly (expected 1, 2 (2 Active), found 1, 2, 3 (3 Active)).",
      ],
      [
        new FlowVersionGuardError(
          'F',
          { numbers: [], active: undefined },
          { numbers: [1], active: undefined }
        ),
        "The versions of Flow 'F' changed unexpectedly (expected - (none Active), found 1 (none Active)).",
      ],
      [
        new FlowTestPinError('T\u0007', [2]),
        "FlowTest 'T' did not come back free of flow-version associations after its deploy.",
      ],
      [
        new FlowTestRestorePinError('T\u0007', [1, 2], []),
        "FlowTest 'T' was deployed back with its versions (1, 2) but came back associated with -.",
      ],
      [
        new FlowTestsNotRunError('F', ['A', 'B\u0007']),
        "FlowTests of Flow 'F' did not run: A, B. A FlowTest that does not run",
      ],
      [
        new FlowTestVersionError('F', 2, [1, 1]),
        "The FlowTests of Flow 'F' were expected to run against version 2, but the org recorded results for: 1, 1.",
      ],
      [
        new FlowTestVersionError('F', 2, []),
        'but the org recorded results for: no recorded result.',
      ],
      [
        new FlowDeployNotCompletedError(
          '0Af1',
          'Canceled',
          false,
          'by\u0007 X'
        ),
        'Metadata API deploy 0Af1 did not complete (Canceled): by  X. What it changed is unknown',
      ],
      [
        new FlowDeployNotCompletedError(
          undefined,
          'Unknown',
          false,
          'ECONNRESET'
        ),
        'Metadata API deploy - did not complete (Unknown): ECONNRESET.',
      ],
      [
        new FlowForeignActiveVersionError('F', 3, 1),
        "Flow 'F' has 3 Active, which this run did not set: version 1 is not activated again over it.",
      ],
      [
        new FlowForeignActiveVersionError('F', undefined, 1),
        "Flow 'F' has none Active, which this run did not set: version 1 is not activated again over it.",
      ],
      [
        new FlowActiveVersionNotDeletedError(2),
        'Version 2, created by this run, is Active and is not deleted.',
      ],
      [
        new FlowRevertError('F', [
          new FlowActiveVersionNotDeletedError(2),
          new Error('socket\u0007 hang up'),
        ]),
        "Flow 'F' could not be put back to its original Active version after a mutant. The run was stopped: Version 2, created by this run, is Active and is not deleted. Activate the Flow's original version again, then delete it.; socket  hang up",
      ],
      [
        new FlowRestoreError('F', [
          new FlowVersionGuardError(
            'F',
            { numbers: [1], active: 1 },
            { numbers: [1, 2], active: 1 }
          ),
          new Error('Could not delete version 2: locked'),
        ]),
        "Flow 'F' and its FlowTests could not be fully restored: The versions of Flow 'F' changed unexpectedly (expected 1 (1 Active), found 1, 2 (1 Active)). The run was stopped to keep the org in a known state.; Could not delete version 2: locked. Check the Flow's versions",
      ],
      [
        new FlowTestRepinFailedError(['bad', 'worse']),
        'The FlowTests could not be detached from their flow versions for the run: bad; worse',
      ],
      [
        new FlowDeployFailedError(['Element x invalid', 'Element y invalid']),
        "The target org refuses to deploy or activate the original content of Flow 'Account_After', so no mutant could be evaluated: Element x invalid; Element y invalid",
      ],
      [
        new FlowRuntimeErrorStreakError('F', 3, 'INVALID\u0007_SESSION_ID'),
        "3 mutants of Flow 'F' in a row could not be run (INVALID _SESSION_ID). The run was stopped",
      ],
    ])(
      'Given the run rejects with %s, When run, Then the bundle message is shown',
      async (error, message) => {
        // Arrange
        orchestratorRun.mockRejectedValue(error)

        // Act & Assert
        await expect(sut.run()).rejects.toThrow(message)
      }
    )

    it('Given a run failure and a failed restore, When run, Then both are rendered through the bundle, the run failure first', async () => {
      // Arrange
      const runError = new FlowChangedOutsideRunError('F', [2])
      orchestratorRun.mockRejectedValue(
        new FlowRunAndRestoreError(
          runError,
          new FlowRestoreError('F', [new FlowActiveVersionNotDeletedError(2)])
        )
      )

      // Act
      const error = (await sut.run().catch((e: unknown) => e)) as Error

      // Assert
      expect(error.name).toBe('FlowRunAndRestoreError')
      expect(error.message).toBe(
        `${messages.getMessage('error.flowChangedOutsideRun', ['F', '2'])}\n${messages.getMessage(
          'error.flowRestoreFailed',
          ['F', messages.getMessage('error.flowActiveVersionNotDeleted', ['2'])]
        )}`
      )
      expect(error.cause).toBeInstanceOf(FlowRunAndRestoreError)
    })

    it('Given an untyped run failure and an untyped restore failure, When run, Then both texts are kept, sanitized', async () => {
      // Arrange
      orchestratorRun.mockRejectedValue(
        new FlowRunAndRestoreError(new Error('boom\u0007'), 'still down')
      )

      // Act & Assert
      await expect(sut.run()).rejects.toThrow(/^boom\nstill down$/)
    })

    it('Given an unclassified error, When run, Then it is rethrown untouched', async () => {
      // Arrange
      const failure = new Error('anything else')
      orchestratorRun.mockRejectedValue(failure)

      // Act & Assert
      await expect(sut.run()).rejects.toBe(failure)
    })
  })
})
