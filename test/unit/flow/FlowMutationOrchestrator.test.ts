import { Messages } from '@salesforce/core'
import type { Progress, Spinner } from '@salesforce/sf-plugins-core'
import { FlowMutantGenerator } from '../../../src/flow/FlowMutantGenerator.js'
import { FlowMutationOrchestrator } from '../../../src/flow/FlowMutationOrchestrator.js'
import type { FlowMutation, FlowMutator } from '../../../src/flow/types.js'
import type { FlowEngineBundle } from '../../../src/port/executionEngine.js'
import {
  FlowTestPinError,
  FlowVersionGuardError,
} from '../../../src/port/flowErrors.js'
import type { FlowSource } from '../../../src/port/flowSourceProvider.js'
import type {
  FlowBaseline,
  FlowMutantVerdict,
  FlowTestBed,
} from '../../../src/port/flowTestBed.js'
import {
  calculateMutationScore,
  FLOW_SCORE_POLICY,
} from '../../../src/service/mutationScore.js'
import {
  flowTestXml,
  flowXml,
  recordTriggeredFlowXml,
} from '../../utils/flowFixtures.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.flow.run'
)

const source = (xml = recordTriggeredFlowXml()): FlowSource => ({
  apiName: 'Account_After',
  xml,
  tests: [{ fullName: 'Sets_Rating', xml: flowTestXml('Account_After') }],
})

const baseline = (overrides: Partial<FlowBaseline> = {}): FlowBaseline => ({
  testsRan: 1,
  failingTests: [],
  cost: { applyMs: 1000, runMs: 2000 },
  ...overrides,
})

// A mutator producing `count` mutants on the trigger type, each distinct.
const fixedMutator = (count: number): FlowMutator => ({
  name: 'Fixed',
  mutate: dom => {
    const trigger = dom.elements('recordTriggerType')[0]
    return Array.from(
      { length: count },
      (_, i): FlowMutation => ({
        mutatorName: 'Fixed',
        elementName: `E${i}`,
        description: `m${i}`,
        edits: [dom.replaceTextEdit(trigger, `Update${i}`)],
      })
    )
  },
})

describe('FlowMutationOrchestrator', () => {
  let spinner: Spinner
  let progress: Progress
  let testBed: { [K in keyof FlowTestBed]: ReturnType<typeof vi.fn> }
  let engine: FlowEngineBundle
  let readFlow: ReturnType<typeof vi.fn>

  const sut = (mutators: FlowMutator[] = [fixedMutator(1)]) =>
    new FlowMutationOrchestrator(
      progress,
      spinner,
      engine,
      messages,
      undefined,
      new FlowMutantGenerator(mutators)
    )

  const run = (mutators?: FlowMutator[], overrides = {}) =>
    sut(mutators).run({
      flowApiName: 'Account_After',
      dryRun: false,
      ...overrides,
    })

  beforeEach(() => {
    spinner = { start: vi.fn(), stop: vi.fn() } as unknown as Spinner
    progress = {
      start: vi.fn(),
      update: vi.fn(),
      finish: vi.fn(),
      stop: vi.fn(),
    } as unknown as Progress
    readFlow = vi.fn().mockResolvedValue(source())
    testBed = {
      prepare: vi.fn().mockImplementation(async (_source, hooks) => {
        hooks.onPreparing()
        hooks.onPrepared()
        hooks.onBaselineStarting()
        return baseline()
      }),
      evaluate: vi
        .fn()
        .mockResolvedValue({ kind: 'executed', failingTests: ['Sets_Rating'] }),
      restore: vi.fn().mockResolvedValue(undefined),
    }
    engine = {
      source: { readFlow },
      testBed: testBed as unknown as FlowTestBed,
    }
  })

  describe('reading and validating', () => {
    it('Given test names, When run, Then the flow is read with them', async () => {
      // Act
      await run(undefined, { flowTestNames: ['Sets_Rating'] })

      // Assert
      expect(readFlow).toHaveBeenCalledWith('Account_After', ['Sets_Rating'])
      expect(spinner.stop).toHaveBeenCalledWith('FlowTests: Sets_Rating')
    })

    it.each([
      [
        '<Flow><a></Flow>',
        /^Flow 'Account_After' is not valid XML: XML parsing failed/,
      ],
      [
        '<FlowTest xmlns="http://soap.sforce.com/2006/04/metadata"/>',
        /does not have a <Flow> root element/,
      ],
      [
        flowXml('    <processType>Flow</processType>'),
        /has process type 'Flow'\. Only record-triggered/,
      ],
      [
        flowXml(
          '    <processType>AutoLaunchedFlow</processType>\n    <waits><name>W</name></waits>'
        ),
        /contains Pause elements/,
      ],
    ])(
      'Given an unusable flow, When run, Then it is rejected with the bundle message and the org is never written',
      async (xml, message) => {
        // Arrange
        readFlow.mockResolvedValue(source(xml))

        // Act & Assert
        await expect(run()).rejects.toThrow(message)
        expect(testBed.prepare).not.toHaveBeenCalled()
        expect(testBed.restore).not.toHaveBeenCalled()
      }
    )

    it('Given an invalid line range, When run, Then it is rejected before the org is read', async () => {
      // Act & Assert
      await expect(run(undefined, { lines: ['x'] })).rejects.toThrow(
        "Invalid line range 'x'"
      )
      expect(readFlow).not.toHaveBeenCalled()
    })
  })

  describe('generating', () => {
    it('Given no mutation, When run, Then it fails naming the flow', async () => {
      // Act & Assert
      await expect(run([fixedMutator(0)])).rejects.toThrow(
        "No mutations could be generated for Flow 'Account_After'."
      )
      expect(testBed.prepare).not.toHaveBeenCalled()
    })

    it('Given a line range excluding every mutant, When run, Then it fails naming the range', async () => {
      // Act & Assert
      await expect(run(undefined, { lines: ['1-2', '40'] })).rejects.toThrow(
        "No mutations could be generated for Flow 'Account_After' within the requested --lines range (1-2, 40)."
      )
    })

    it('Given a line range including the mutant, When run, Then it is evaluated', async () => {
      // Act
      const result = await run(undefined, { lines: ['7'] })

      // Assert
      expect(result.mutants).toHaveLength(1)
    })
  })

  describe('dry run', () => {
    it('Given a dry run, When run, Then mutants stay Pending and the org is never written', async () => {
      // Act
      const result = await run([fixedMutator(2)], { dryRun: true })

      // Assert
      expect(result).toMatchObject({
        flowApiName: 'Account_After',
        sourceXml: recordTriggeredFlowXml(),
      })
      expect(result.mutants.map(m => m.status)).toEqual(['Pending', 'Pending'])
      expect(testBed.prepare).not.toHaveBeenCalled()
      expect(testBed.restore).not.toHaveBeenCalled()
    })
  })

  describe('evaluating', () => {
    it('Given the mutated XML, When evaluated, Then the test bed receives the original with only the edit applied', async () => {
      // Act
      await run()

      // Assert
      expect(testBed.evaluate).toHaveBeenCalledWith(
        recordTriggeredFlowXml().replace(
          '<recordTriggerType>Create</recordTriggerType>',
          '<recordTriggerType>Update0</recordTriggerType>'
        )
      )
    })

    it.each<[FlowMutantVerdict, string, object]>([
      [
        { kind: 'executed', failingTests: ['Sets_Rating'] },
        'Killed',
        { killedBy: ['Sets_Rating'] },
      ],
      [{ kind: 'executed', failingTests: [] }, 'Survived', {}],
      [
        { kind: 'not-compilable', detail: 'bad' },
        'CompileError',
        { statusReason: 'bad' },
      ],
    ])(
      'Given the verdict %j, When evaluated, Then the mutant is %s',
      async (verdict, status, extra) => {
        // Arrange
        testBed.evaluate.mockResolvedValue(verdict)

        // Act
        const result = await run()

        // Assert
        expect(result.mutants[0]).toMatchObject({ status, ...extra })
        expect(progress.update).toHaveBeenLastCalledWith(1, {
          info: expect.stringContaining(
            messages.getMessage(`info.mutantResult.${status}`)
          ),
        })
      }
    )

    it('Given the test transport fails on a mutant run, When evaluated, Then the mutant is not counted as Killed', async () => {
      // Arrange — review proof
      testBed.evaluate.mockRejectedValue(new Error('socket hang up'))

      // Act
      const result = await run()

      // Assert
      expect(result.mutants[0]).toMatchObject({
        status: 'RuntimeError',
        statusReason: 'socket hang up',
      })
      const score = calculateMutationScore(
        result.mutants.map(m => m.status),
        FLOW_SCORE_POLICY
      )
      expect(score).not.toBe(100)
      expect(testBed.restore).toHaveBeenCalledTimes(1)
    })

    it('Given a non-Error rejection on a mutant, When evaluated, Then its text becomes the reason', async () => {
      // Arrange
      testBed.evaluate.mockRejectedValue('down')

      // Act
      const result = await run()

      // Assert
      expect(result.mutants[0].statusReason).toBe('down')
    })

    it('Given 2 killed and 1 survived, When scored, Then the score matches the Apex command (66.67, unrounded)', async () => {
      // Arrange — review proof
      testBed.evaluate
        .mockResolvedValueOnce({ kind: 'executed', failingTests: ['t1'] })
        .mockResolvedValueOnce({ kind: 'executed', failingTests: ['t1'] })
        .mockResolvedValueOnce({ kind: 'executed', failingTests: [] })

      // Act
      const result = await run([fixedMutator(3)])

      // Assert
      expect(
        calculateMutationScore(
          result.mutants.map(m => m.status),
          FLOW_SCORE_POLICY
        )
      ).toBeCloseTo(66.67, 1)
    })

    it.each([
      new FlowVersionGuardError(
        'Account_After',
        { numbers: [1], active: 1 },
        { numbers: [1, 2], active: 1 }
      ),
      new FlowTestPinError('Sets_Rating', [2]),
    ])(
      'Given a failed org safety check, When evaluating, Then the run aborts and the org is restored',
      async error => {
        // Arrange
        testBed.evaluate.mockRejectedValue(error)

        // Act & Assert
        await expect(run([fixedMutator(2)])).rejects.toBe(error)
        expect(testBed.evaluate).toHaveBeenCalledTimes(1)
        expect(testBed.restore).toHaveBeenCalledTimes(1)
        expect(progress.stop).toHaveBeenCalled()
      }
    )

    it('Given a progress bar that cannot be torn down, When the run fails, Then the failure is reported and the restore still runs', async () => {
      // Arrange
      const outputSink = vi.fn()
      testBed.evaluate.mockRejectedValue(new FlowTestPinError('t', [2]))
      vi.mocked(progress.stop).mockImplementation(() => {
        throw new Error('tty\u001bgone')
      })
      const sut = new FlowMutationOrchestrator(
        progress,
        spinner,
        engine,
        messages,
        undefined,
        new FlowMutantGenerator([fixedMutator(1)]),
        outputSink
      )

      // Act
      const result = sut.run({ flowApiName: 'Account_After', dryRun: false })

      // Assert
      await expect(result).rejects.toBeInstanceOf(FlowTestPinError)
      expect(testBed.restore).toHaveBeenCalledTimes(1)
      expect(outputSink).toHaveBeenCalledTimes(1)
      expect(outputSink).toHaveBeenCalledWith(
        'Warning: could not tear down the progress display. Cause: tty gone\n'
      )
    })

    it('Given several mutants, When evaluated, Then progress reports each and the time estimate uses the baseline cost', async () => {
      // Act
      await run([fixedMutator(2)])

      // Assert
      expect(progress.start).toHaveBeenCalledWith(
        2,
        { info: 'Starting mutation testing' },
        expect.anything()
      )
      expect(spinner.start).toHaveBeenCalledWith(
        'Estimated time: ~6s',
        undefined,
        { stdout: true }
      )
      expect(spinner.stop).toHaveBeenCalledWith(
        'Deploy: ~1s/mutant | Test: ~2s/mutant | Mutants: 2'
      )
      expect(progress.finish).toHaveBeenCalledWith({
        info: 'All mutations evaluated',
      })
    })
  })

  describe('baseline', () => {
    it('Given failing tests on the original flow, When run, Then it fails naming them and the org is restored', async () => {
      // Arrange
      testBed.prepare.mockResolvedValue(
        baseline({ failingTests: ['Sets_Rating'] })
      )

      // Act & Assert
      await expect(run()).rejects.toThrow(
        "The FlowTests of Flow 'Account_After' fail against the original Flow: Sets_Rating."
      )
      expect(testBed.evaluate).not.toHaveBeenCalled()
      expect(testBed.restore).toHaveBeenCalledTimes(1)
    })

    it('Given prepare fails part-way, When run, Then the org is still restored and the prepare failure surfaces', async () => {
      // Arrange
      const failure = new Error('deploy refused')
      testBed.prepare.mockRejectedValue(failure)

      // Act & Assert
      await expect(run()).rejects.toBe(failure)
      expect(testBed.restore).toHaveBeenCalledTimes(1)
    })
  })

  describe('restore', () => {
    it('Given the rollback deploy fails, When run, Then the run rejects', async () => {
      // Arrange — review proof
      testBed.restore.mockRejectedValue(new Error('org down'))

      // Act & Assert
      await expect(run()).rejects.toThrow(
        "Restoring Flow 'Account_After' failed: org down. Check the Flow's versions and FlowTests on the target org and restore them manually."
      )
      expect(spinner.stop).toHaveBeenCalledWith('Restore FAILED')
    })

    it('Given the run and the restore both fail, When run, Then the run failure leads and the restore failure is appended', async () => {
      // Arrange
      const runFailure = new FlowVersionGuardError(
        'Account_After',
        { numbers: [1], active: 1 },
        { numbers: [1, 2], active: 1 }
      )
      testBed.evaluate.mockRejectedValue(runFailure)
      testBed.restore.mockRejectedValue('still down')

      // Act
      const error = await run().catch((e: Error) => e)

      // Assert
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe(
        `${runFailure.message}\nRestoring Flow 'Account_After' failed: still down. Check the Flow's versions and FlowTests on the target org and restore them manually.`
      )
      expect((error as Error).cause).toBe(runFailure)
    })

    it('Given a non-Error run failure and a failed restore, When run, Then both texts are kept', async () => {
      // Arrange
      testBed.prepare.mockRejectedValue('boom')
      testBed.restore.mockRejectedValue(new Error('down'))

      // Act & Assert
      await expect(run()).rejects.toThrow(/^boom\nRestoring Flow/)
    })

    it('Given a successful run, When it ends, Then the restore runs once after every mutant', async () => {
      // Act
      await run([fixedMutator(3)])

      // Assert
      expect(testBed.restore).toHaveBeenCalledTimes(1)
      expect(testBed.restore.mock.invocationCallOrder[0]).toBeGreaterThan(
        testBed.evaluate.mock.invocationCallOrder[2]
      )
      expect(spinner.start).toHaveBeenCalledWith(
        'Restoring Flow "Account_After" and its FlowTests to their original state',
        undefined,
        { stdout: true }
      )
    })
  })

  describe('what the user sees', () => {
    it('Given a full run, When it completes, Then every phase is announced on stdout with the flow name', async () => {
      // Arrange
      readFlow.mockResolvedValue({
        ...source(),
        tests: [
          { fullName: 'A', xml: '' },
          { fullName: 'B', xml: '' },
        ],
      })

      // Act
      await run()

      // Assert
      const started = vi.mocked(spinner.start).mock.calls
      expect(started).toEqual(
        expect.arrayContaining([
          [
            'Reading Flow "Account_After" and its FlowTests from the org',
            undefined,
            { stdout: true },
          ],
          [
            'Generating mutants for Flow "Account_After"',
            undefined,
            { stdout: true },
          ],
          [
            'Preparing Flow "Account_After" and its FlowTests for the run',
            undefined,
            { stdout: true },
          ],
          [
            'Running 2 FlowTest(s) against the original Flow',
            undefined,
            { stdout: true },
          ],
        ])
      )
      expect(spinner.stop).toHaveBeenCalledWith('FlowTests: A, B')
      expect(spinner.stop).toHaveBeenCalledWith('1 mutations generated')
      expect(spinner.stop).toHaveBeenCalledWith('Done')
      expect(spinner.stop).toHaveBeenCalledWith('Original tests passed')
      expect(progress.start).toHaveBeenCalledWith(
        1,
        { info: 'Starting mutation testing' },
        {
          title: 'MUTATION TESTING PROGRESS',
          format: '%s | {bar} | {value}/{total} {info}',
        }
      )
      expect(progress.update).toHaveBeenNthCalledWith(1, 0, {
        info: 'Evaluating mutant: m0',
      })
      expect(progress.update).toHaveBeenNthCalledWith(2, 1, {
        info: 'Remaining: ~0s | Mutation result: mutant killed',
      })
    })

    it('Given two failing baseline tests, When run, Then both are named', async () => {
      // Arrange
      testBed.prepare.mockResolvedValue(baseline({ failingTests: ['A', 'B'] }))

      // Act & Assert
      await expect(run()).rejects.toThrow('original Flow: A, B.')
      expect(spinner.stop).toHaveBeenCalledWith('Original tests failed')
    })

    it('Given Pause elements, When run, Then the message names the flow', async () => {
      // Arrange
      readFlow.mockResolvedValue(
        source(
          flowXml(
            '    <processType>AutoLaunchedFlow</processType>\n    <waits><name>W</name></waits>'
          )
        )
      )

      // Act & Assert
      await expect(run()).rejects.toThrow(
        "Flow 'Account_After' contains Pause elements. Flows with Pause elements cannot be tested with FlowTests."
      )
    })

    it('Given a range that parses but is not a line range, When run, Then the shared validation rejects it', async () => {
      // Act & Assert
      await expect(run(undefined, { lines: ['7.5'] })).rejects.toThrow(
        "Invalid line range '7.5'"
      )
    })

    it('Given a failed restore, When run, Then the restore failure is kept as the cause', async () => {
      // Arrange
      const failure = new Error('org down')
      testBed.restore.mockRejectedValue(failure)

      // Act
      const error = (await run().catch((e: unknown) => e)) as Error

      // Assert
      expect(error.cause).toBe(failure)
    })
  })
})
