import { createOrgFlowEngine } from '../../../../../../src/adapter/org/orgEngine.js'
import FlowMutationRun from '../../../../../../src/commands/apex/mutation/flow/run.js'
import { FlowMutationOrchestrator } from '../../../../../../src/flow/FlowMutationOrchestrator.js'
import type { FlowMutant } from '../../../../../../src/flow/types.js'
import {
  FlowAmbiguousError,
  FlowApiVersionTooLowError,
  FlowDeployFailedError,
  FlowDraftBesideActiveError,
  FlowNotFoundError,
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
      integer: vi.fn(options => options),
      requiredOrg: vi.fn().mockReturnValue({}),
      orgApiVersion: vi.fn().mockReturnValue({}),
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

  beforeEach(() => {
    vi.mocked(createOrgFlowEngine).mockResolvedValue({
      source: { readFlow: vi.fn() },
      testBed: { prepare: vi.fn(), evaluate: vi.fn(), restore: vi.fn() },
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
      mutants: [
        statusMutant('Killed'),
        statusMutant('Killed'),
        statusMutant('Survived'),
      ],
    })
    sut = new (FlowMutationRun as unknown as new () => typeof sut)()
    sut.parse.mockResolvedValue({ flags: flags() })
  })

  describe('flags', () => {
    it('Given the declaration, When read, Then it mirrors the Apex command: -f for the flow, -t for its tests, an existing report dir, a required org', () => {
      // Act
      const declared = FlowMutationRun.flags as unknown as Record<
        string,
        Record<string, unknown>
      >

      // Assert
      expect(declared.flow).toMatchObject({ char: 'f', required: true })
      expect(declared['flow-test']).toMatchObject({
        char: 't',
        multiple: true,
        delimiter: ',',
      })
      expect(declared['flow-test'].aliases).toBeUndefined()
      expect(declared['report-dir']).toMatchObject({
        char: 'r',
        exists: true,
        default: 'mutations',
      })
      expect(declared).not.toHaveProperty('test-apex')
      expect(declared).not.toHaveProperty('flow-name')
    })

    it('Given the declaration, When read, Then allow-non-sandbox-org is an opt-in boolean defaulting to false', () => {
      // Act
      const declared = FlowMutationRun.flags as unknown as Record<
        string,
        Record<string, unknown>
      >

      // Assert
      expect(declared['allow-non-sandbox-org']).toMatchObject({
        default: false,
      })
    })

    it('Given the declaration, When read, Then the command is marked beta', () => {
      // Assert
      expect(FlowMutationRun.state).toBe('beta')
    })
  })

  describe('run', () => {
    it('Given --allow-non-sandbox-org, When run, Then the engine is built with allowNonSandbox', async () => {
      // Arrange
      sut.parse.mockResolvedValue({
        flags: flags({ 'allow-non-sandbox-org': true }),
      })

      // Act
      await sut.run()

      // Assert
      expect(createOrgFlowEngine).toHaveBeenCalledWith(expect.anything(), {
        allowNonSandbox: true,
      })
    })

    it('Given a run, When it completes, Then the engine is built on the requested API version and the score is returned unrounded as the only JSON field', async () => {
      // Act
      const result = await sut.run()

      // Assert
      expect(getConnection).toHaveBeenCalledWith('66.0')
      expect(createOrgFlowEngine).toHaveBeenCalledWith(
        {
          connection: { conn: true },
          notify: expect.any(Function),
        },
        { allowNonSandbox: undefined }
      )
      expect(orchestratorRun).toHaveBeenCalledWith({
        flowApiName: 'Account_After',
        flowTestNames: undefined,
        lines: undefined,
        dryRun: false,
      })
      expect(result).toEqual({ score: (2 / 3) * 100 })
      expect(sut.log).toHaveBeenCalledWith(`Mutation score: ${(2 / 3) * 100}%`)
      expect(sut.log).toHaveBeenCalledWith(
        'Running mutation testing for Flow "Account_After" with FlowTest(s) "all FlowTests"'
      )
      expect(sut.log).toHaveBeenCalledWith(
        'Report has been generated at this location: mutations'
      )
      expect(sut.info).toHaveBeenCalledWith(
        expect.stringContaining('Enjoying apex-mutation-testing?')
      )
    })

    it('Given flow tests and lines, When run, Then they are trimmed and passed through', async () => {
      // Arrange
      sut.parse.mockResolvedValue({
        flags: flags({
          flow: ' Account_After ',
          'flow-test': [' Sets_Rating', 'Account_After.Keeps'],
          lines: ['1-5'],
        }),
      })

      // Act
      await sut.run()

      // Assert
      expect(orchestratorRun).toHaveBeenCalledWith({
        flowApiName: 'Account_After',
        flowTestNames: ['Sets_Rating', 'Account_After.Keeps'],
        lines: ['1-5'],
        dryRun: false,
      })
      expect(sut.log).toHaveBeenCalledWith(
        'Running mutation testing for Flow "Account_After" with FlowTest(s) "Sets_Rating, Account_After.Keeps"'
      )
    })

    it('Given a dry run, When run, Then no score is computed nor logged', async () => {
      // Arrange
      sut.parse.mockResolvedValue({
        flags: flags({ 'dry-run': true, threshold: 100 }),
      })

      // Act
      const result = await sut.run()

      // Assert
      expect(result).toEqual({ score: null })
      expect(sut.log).toHaveBeenCalledWith(
        'Running dry run mutation testing for Flow "Account_After" with FlowTest(s) "all FlowTests"'
      )
      expect(sut.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Mutation score')
      )
    })

    it('Given a score below the threshold, When run, Then it fails with the shared threshold message after the report', async () => {
      // Arrange
      sut.parse.mockResolvedValue({ flags: flags({ threshold: 67 }) })

      // Act & Assert
      await expect(sut.run()).rejects.toThrow(
        `Mutation score ${(2 / 3) * 100}% is below the required threshold of 67%`
      )
      expect(generateReport).toHaveBeenCalled()
    })

    it('Given a score meeting the threshold, When run, Then it succeeds', async () => {
      // Arrange
      sut.parse.mockResolvedValue({ flags: flags({ threshold: 66 }) })

      // Act & Assert
      await expect(sut.run()).resolves.toEqual({ score: (2 / 3) * 100 })
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

  describe('name validation', () => {
    it.each([['1Flow'], ['Flow-Name'], ["Fl'ow"]])(
      'Given the flow name %s, When run, Then it is rejected before any org call',
      async flow => {
        // Arrange
        sut.parse.mockResolvedValue({ flags: flags({ flow }) })

        // Act & Assert
        await expect(sut.run()).rejects.toThrow(
          `Invalid Flow API name: '${flow}'`
        )
        expect(createOrgFlowEngine).not.toHaveBeenCalled()
      }
    )

    it('Given a test name with a quote, When run, Then it is rejected before any org call', async () => {
      // Arrange
      sut.parse.mockResolvedValue({ flags: flags({ 'flow-test': ["T'1"] }) })

      // Act & Assert
      await expect(sut.run()).rejects.toThrow("Invalid FlowTest name: 'T'1'")
      expect(createOrgFlowEngine).not.toHaveBeenCalled()
    })
  })

  describe('error rendering', () => {
    it.each<[string, Error, string]>([
      [
        'production',
        new ProductionOrgError(),
        'The target org is not a sandbox.',
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

    it.each<[Error, string]>([
      [new FlowNotFoundError('F'), "Flow 'F' was not found on the target org."],
      [new FlowAmbiguousError('F', 2), "Flow 'F' matches 2 flow definitions"],
      [
        new NoFlowTestsError('F'),
        "Flow 'F' has no FlowTest on the target org.",
      ],
      [
        new FlowTestNotFoundError('F', ['A', 'B\u0007']),
        "FlowTest(s) not found for Flow 'F': A, B.",
      ],
      [
        new UnsupportedFlowVersionStateError('F', 'Obsolete'),
        "The latest version of Flow 'F' has status 'Obsolete'.",
      ],
      [
        new FlowDraftBesideActiveError('F', 3, 2),
        "The latest version of Flow 'F' (version 3) is a Draft beside the Active version 2.",
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
        new FlowTestPinError('T', [2]),
        "FlowTest 'T' did not come back free of flow-version associations after its deploy.",
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
        new FlowRevertError('F', ['cannot activate', 'socket hang up']),
        "Flow 'F' could not be put back to its original Active version after a mutant: cannot activate; socket hang up. The run was stopped.",
      ],
      [
        new FlowTestRepinFailedError(['bad', 'worse']),
        'The FlowTests could not be detached from their flow versions for the run: bad; worse',
      ],
      [
        new FlowDeployFailedError(['Element x invalid']),
        "The target org refuses to deploy or activate the original content of Flow 'Account_After', so no mutant could be evaluated: Element x invalid",
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

    it('Given an unclassified error, When run, Then it is rethrown untouched', async () => {
      // Arrange
      const failure = new Error('anything else')
      orchestratorRun.mockRejectedValue(failure)

      // Act & Assert
      await expect(sut.run()).rejects.toBe(failure)
    })
  })
})
