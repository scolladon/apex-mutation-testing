import { Messages } from '@salesforce/core'
import type { Progress, Spinner } from '@salesforce/sf-plugins-core'
import { FlowMutantGenerator } from '../../../src/flow/FlowMutantGenerator.js'
import { FlowMutationOrchestrator } from '../../../src/flow/FlowMutationOrchestrator.js'
import type { FlowMutation, FlowMutator } from '../../../src/flow/types.js'
import type { FlowEngineBundle } from '../../../src/port/executionEngine.js'
import {
  FlowRunAndRestoreError,
  FlowRuntimeErrorStreakError,
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
    return Array.from({ length: count }, (_, i): FlowMutation => {
      const edit = dom.replaceTextEdit(trigger, `Update${i}`)
      return {
        mutatorName: 'Fixed',
        elementName: `E${i}`,
        description: `m${i}`,
        edits: [edit],
        anchor: { start: edit.start, end: edit.end },
        replacement: edit.replacement,
      }
    })
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
      needsRestore: vi.fn().mockReturnValue(true),
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
        "No mutations could be generated for Flow 'Account_After': none of its elements"
      )
      expect(testBed.prepare).not.toHaveBeenCalled()
    })

    it('Given a line range excluding every mutant, When run, Then it fails naming the range', async () => {
      // Act & Assert
      await expect(run(undefined, { lines: ['1-2', '40'] })).rejects.toThrow(
        "No mutations could be generated for Flow 'Account_After' within the requested --lines range (1-2, 40)."
      )
    })

    it.each([
      ['an include list naming no mutator', { includeMutators: ['Other'] }],
      ['an exclude list naming every mutator', { excludeMutators: ['fixed'] }],
    ])(
      'Given %s, When run, Then it fails as the Apex command does: every mutator excluded',
      async (_label, filter) => {
        // Act & Assert
        await expect(run(undefined, filter)).rejects.toThrow(
          'All mutators have been excluded by configuration'
        )
        expect(testBed.prepare).not.toHaveBeenCalled()
      }
    )

    it('Given mutator names no mutator answers to, When run, Then each is warned about as the Apex command does', async () => {
      // Arrange
      const warn = vi
        .spyOn(process, 'emitWarning')
        .mockImplementation(() => undefined)

      // Act
      const result = await run(undefined, {
        excludeMutators: ['NoSuchMutator', 'FixedMutator', 'Bad\u001b[31m'],
      }).catch((error: unknown) => error)

      // Assert
      expect(warn.mock.calls).toEqual([
        ["Unknown mutator name: 'NoSuchMutator' — skipping"],
        ["Unknown mutator name: 'Bad [31m' — skipping"],
      ])
      expect(result).toEqual(
        new Error('All mutators have been excluded by configuration')
      )
      warn.mockRestore()
    })

    it('Given a filter leaving no mutator, When run, Then it fails before the org is read', async () => {
      // Act & Assert
      await expect(
        run(undefined, { includeMutators: ['Other'] })
      ).rejects.toThrow('All mutators have been excluded by configuration')
      expect(readFlow).not.toHaveBeenCalled()
      expect(spinner.start).not.toHaveBeenCalled()
    })

    it('Given no mutator filter, When run, Then nothing is warned about', async () => {
      // Arrange
      const warn = vi
        .spyOn(process, 'emitWarning')
        .mockImplementation(() => undefined)

      // Act
      await run()

      // Assert
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    it('Given the same unknown name twice in two spellings, When run, Then it is warned about once', async () => {
      // Arrange
      const warn = vi
        .spyOn(process, 'emitWarning')
        .mockImplementation(() => undefined)

      // Act
      await run(undefined, { excludeMutators: ['Nope', 'NOPE', 'nopemutator'] })

      // Assert
      expect(warn.mock.calls).toEqual([
        ["Unknown mutator name: 'Nope' — skipping"],
      ])
      warn.mockRestore()
    })

    it('Given the flow named in another case than the org spells it, When generating, Then the messages use the org spelling', async () => {
      // Arrange
      readFlow.mockResolvedValue({ ...source(), apiName: 'Account_After' })

      // Act & Assert
      await expect(
        sut([fixedMutator(0)]).run({
          flowApiName: 'account_after',
          dryRun: false,
        })
      ).rejects.toThrow("Flow 'Account_After'")
      expect(spinner.start).toHaveBeenCalledWith(
        messages.getMessage('info.generatingMutants', ['Account_After']),
        undefined,
        { stdout: true }
      )
    })

    it('Given a filter keeping a mutator that finds nothing, When run, Then it fails naming the mutator filter', async () => {
      // Arrange
      const other: FlowMutator = { name: 'Other', mutate: () => [] }

      // Act & Assert
      await expect(
        run([fixedMutator(1), other], { includeMutators: ['Other'] })
      ).rejects.toThrow(
        "No mutations could be generated for Flow 'Account_After' with the requested mutators."
      )
      expect(testBed.prepare).not.toHaveBeenCalled()
    })

    it('Given a filter keeping a mutator that finds mutants only outside the line range, When run, Then the line range is named', async () => {
      // Arrange
      const other: FlowMutator = { name: 'Other', mutate: () => [] }

      // Act & Assert
      await expect(
        run([fixedMutator(1), other], {
          includeMutators: ['Fixed'],
          lines: ['1'],
        })
      ).rejects.toThrow('within the requested --lines range (1)')
    })

    it('Given a line range and a flow with no mutation at all, When run, Then the flow itself is named, not the range', async () => {
      // Act & Assert
      await expect(run([fixedMutator(0)], { lines: ['1'] })).rejects.toThrow(
        "No mutations could be generated for Flow 'Account_After': none of its elements"
      )
    })

    it.each([
      ['its name', { includeMutators: ['Fixed'] }],
      ['another name', { excludeMutators: ['Other'] }],
    ])(
      'Given a mutator filter keeping the mutator by %s, When run, Then its mutants are evaluated',
      async (_label, filter) => {
        // Act
        const result = await run(undefined, filter)

        // Assert
        expect(result.mutants).toHaveLength(1)
      }
    )

    it('Given a filter that narrows nothing and a line range excluding every mutant, When run, Then the line range is named', async () => {
      // Act & Assert
      await expect(
        run(undefined, { excludeMutators: ['Other'], lines: ['1'] })
      ).rejects.toThrow('within the requested --lines range (1)')
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
        testNames: ['Sets_Rating'],
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

    it('Given 3 mutants in a row failing to run, When evaluated, Then the run stops naming the last reason and the org is restored', async () => {
      // Arrange
      testBed.evaluate
        .mockRejectedValueOnce(new Error('first'))
        .mockRejectedValueOnce(new Error('second'))
        .mockRejectedValueOnce(new Error('INVALID_SESSION_ID'))

      // Act
      const error = await run([fixedMutator(5)]).catch((e: unknown) => e)

      // Assert
      expect(error).toEqual(
        new FlowRuntimeErrorStreakError(
          'Account_After',
          3,
          'INVALID_SESSION_ID'
        )
      )
      expect(testBed.evaluate).toHaveBeenCalledTimes(3)
      expect(testBed.restore).toHaveBeenCalledTimes(1)
    })

    it('Given RuntimeErrors broken up by a verdict, When evaluated, Then the run goes on', async () => {
      // Arrange
      testBed.evaluate
        .mockRejectedValueOnce(new Error('a'))
        .mockRejectedValueOnce(new Error('b'))
        .mockResolvedValueOnce({ kind: 'executed', failingTests: [] })
        .mockRejectedValueOnce(new Error('c'))
        .mockRejectedValueOnce(new Error('d'))

      // Act
      const result = await run([fixedMutator(5)])

      // Assert
      expect(result.mutants.map(m => m.status)).toEqual([
        'RuntimeError',
        'RuntimeError',
        'Survived',
        'RuntimeError',
        'RuntimeError',
      ])
    })

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
        'Deploy and revert: ~1s/mutant | Test: ~2s/mutant | Mutants: 2'
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
    it('Given the rollback deploy fails, When run, Then the run rejects with that failure, typed', async () => {
      // Arrange — review proof
      const failure = new Error('org down')
      testBed.restore.mockRejectedValue(failure)

      // Act & Assert
      await expect(run()).rejects.toBe(failure)
      expect(spinner.stop).toHaveBeenCalledWith('Restore failed')
    })

    it('Given a refusal before any write, When run, Then no restore is announced nor attempted', async () => {
      // Arrange
      const refusal = new Error('leftover version')
      testBed.prepare.mockRejectedValue(refusal)
      testBed.needsRestore.mockReturnValue(false)

      // Act & Assert
      await expect(run()).rejects.toBe(refusal)
      expect(testBed.restore).not.toHaveBeenCalled()
      expect(spinner.start).not.toHaveBeenCalledWith(
        'Restoring Flow "Account_After" and its FlowTests to their original state',
        undefined,
        { stdout: true }
      )
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
      expect(error).toBeInstanceOf(FlowRunAndRestoreError)
      expect((error as FlowRunAndRestoreError).runError).toBe(runFailure)
      expect((error as FlowRunAndRestoreError).restoreError).toBe('still down')
      expect((error as Error).message).toBe(`${runFailure.message}\nstill down`)
      expect((error as Error).cause).toBe(runFailure)
    })

    it('Given a non-Error run failure and a failed restore, When run, Then both texts are kept', async () => {
      // Arrange
      testBed.prepare.mockRejectedValue('boom')
      testBed.restore.mockRejectedValue(new Error('down'))

      // Act & Assert
      await expect(run()).rejects.toThrow(/^boom\ndown$/)
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
      // once when the FlowTests are prepared, once when the restore is done
      expect(
        vi.mocked(spinner.stop).mock.calls.filter(([text]) => text === 'Done')
      ).toHaveLength(2)
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

      // Act
      const error = (await run().catch(e => e)) as Error

      // Assert — exactly the bundle text: no token appended to it
      expect(error.message).toBe(
        "Flow 'Account_After' contains Pause elements. Flows with Pause elements cannot be tested with FlowTests."
      )
    })

    it('Given a range that parses but is not a line range, When run, Then the shared validation rejects it', async () => {
      // Act & Assert
      await expect(run(undefined, { lines: ['7.5'] })).rejects.toThrow(
        "Invalid line range '7.5'"
      )
    })

    it.each([
      [
        'a Scheduled Path',
        '<pathType>AsyncAfterCommit</pathType>',
        false,
        true,
      ],
      ['an Async Path', '<offsetNumber>1</offsetNumber>', true, false],
    ])(
      'Given a flow with %s beside another kind, When run, Then each kind is announced once',
      async () => {
        // Arrange
        const outputSink = vi.fn()
        readFlow.mockResolvedValue(
          source(
            recordTriggeredFlowXml().replace(
              '<object>Account</object>',
              '<object>Account</object>\n        <scheduledPaths><name>Later</name><offsetNumber>1</offsetNumber></scheduledPaths>\n        <scheduledPaths><pathType>AsyncAfterCommit</pathType></scheduledPaths>'
            )
          )
        )

        // Act
        await new FlowMutationOrchestrator(
          progress,
          spinner,
          engine,
          messages,
          undefined,
          new FlowMutantGenerator([fixedMutator(1)]),
          outputSink
        ).run({ flowApiName: 'Account_After', dryRun: false })

        // Assert
        expect(outputSink.mock.calls).toEqual([
          [`${messages.getMessage('info.hasScheduledPath')}\n`],
          [`${messages.getMessage('info.hasAsyncPath')}\n`],
        ])
      }
    )

    it.each([
      [
        'only a Scheduled Path',
        '<scheduledPaths><offsetNumber>1</offsetNumber></scheduledPaths>',
        'info.hasScheduledPath',
      ],
      [
        'only an Async Path',
        '<scheduledPaths><pathType>AsyncAfterCommit</pathType></scheduledPaths>',
        'info.hasAsyncPath',
      ],
    ])(
      'Given a flow with %s, When run, Then only that kind is announced',
      async (_label, paths, key) => {
        // Arrange
        const outputSink = vi.fn()
        readFlow.mockResolvedValue(
          source(
            recordTriggeredFlowXml().replace(
              '<object>Account</object>',
              `<object>Account</object>\n        ${paths}`
            )
          )
        )

        // Act
        await new FlowMutationOrchestrator(
          progress,
          spinner,
          engine,
          messages,
          undefined,
          new FlowMutantGenerator([fixedMutator(1)]),
          outputSink
        ).run({ flowApiName: 'Account_After', dryRun: false })

        // Assert
        expect(outputSink.mock.calls).toEqual([
          [`${messages.getMessage(key)}\n`],
        ])
      }
    )

    it('Given a dry run of a flow with a Scheduled Path, When run, Then nothing is announced', async () => {
      // Arrange — no mutant is ever Active on a dry run
      const outputSink = vi.fn()
      readFlow.mockResolvedValue(
        source(
          recordTriggeredFlowXml().replace(
            '<object>Account</object>',
            '<object>Account</object>\n        <scheduledPaths><offsetNumber>1</offsetNumber></scheduledPaths>'
          )
        )
      )

      // Act
      await new FlowMutationOrchestrator(
        progress,
        spinner,
        engine,
        messages,
        undefined,
        new FlowMutantGenerator([fixedMutator(1)]),
        outputSink
      ).run({ flowApiName: 'Account_After', dryRun: true })

      // Assert
      expect(outputSink).not.toHaveBeenCalled()
    })

    it('Given a dry run of a flow with an Async Path, When run, Then the Async Path is announced: it explains the mutants not listed', async () => {
      // Arrange
      const outputSink = vi.fn()
      readFlow.mockResolvedValue(
        source(
          recordTriggeredFlowXml().replace(
            '<object>Account</object>',
            '<object>Account</object>\n        <scheduledPaths><offsetNumber>1</offsetNumber></scheduledPaths>\n        <scheduledPaths><pathType>AsyncAfterCommit</pathType></scheduledPaths>'
          )
        )
      )

      // Act
      await new FlowMutationOrchestrator(
        progress,
        spinner,
        engine,
        messages,
        undefined,
        new FlowMutantGenerator([fixedMutator(1)]),
        outputSink
      ).run({ flowApiName: 'Account_After', dryRun: true })

      // Assert
      expect(outputSink.mock.calls).toEqual([
        [`${messages.getMessage('info.hasAsyncPath')}\n`],
      ])
    })

    it('Given a flow without any path, When run, Then nothing is announced', async () => {
      // Arrange
      const outputSink = vi.fn()

      // Act
      await new FlowMutationOrchestrator(
        progress,
        spinner,
        engine,
        messages,
        undefined,
        new FlowMutantGenerator([fixedMutator(1)]),
        outputSink
      ).run({ flowApiName: 'Account_After', dryRun: true })

      // Assert
      expect(outputSink).not.toHaveBeenCalled()
    })
  })

  describe('text from the org on the terminal', () => {
    const ESC = '\u001b'

    it('Given names and descriptions holding control characters, When run, Then they reach the terminal sanitized', async () => {
      // Arrange
      readFlow.mockResolvedValue({
        ...source(),
        tests: [{ fullName: `Sets${ESC}[2J`, xml: '' }],
      })
      const mutator: FlowMutator = {
        name: 'Fixed',
        mutate: dom =>
          fixedMutator(1)
            .mutate(dom)
            .map(mutation => ({ ...mutation, description: `m${ESC}[31m` })),
      }

      // Act
      await run([mutator])

      // Assert
      expect(spinner.stop).toHaveBeenCalledWith(
        messages.getMessage('info.flowRead', ['Sets [2J'])
      )
      expect(progress.update).toHaveBeenCalledWith(0, {
        info: expect.stringContaining(
          messages.getMessage('info.evaluatingMutant', ['m [31m'])
        ),
      })
    })

    it('Given a failing baseline test named with control characters, When run, Then its name reaches the message sanitized', async () => {
      // Arrange
      testBed.prepare.mockResolvedValue({
        ...baseline(),
        failingTests: [`Sets${ESC}[2J`],
      })

      // Act & Assert
      await expect(run()).rejects.toThrow(
        messages.getMessage('error.baselineTestsFailed', [
          'Account_After',
          'Sets [2J',
        ])
      )
    })

    it('Given XML the parser rejects with control characters in its message, When run, Then the detail is sanitized', async () => {
      // Arrange
      readFlow.mockResolvedValue(source(`<Flow${ESC}>`))

      // Act
      const error = (await run().catch((e: unknown) => e)) as Error

      // Assert
      expect(error.message).not.toContain(ESC)
    })
  })
})
