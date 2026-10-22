import { Console } from 'node:console'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FlowMutationRun from '../../../src/commands/apex/mutation/flow/run.js'
import { FlowMutationOrchestrator } from '../../../src/flow/FlowMutationOrchestrator.js'
import { FlowResolver } from '../../../src/flow/FlowResolver.js'
import { SF_NAMESPACE } from '../../../src/flow/xml/FlowXmlDom.js'

const globalWithConsole = globalThis as unknown as {
  console: { Console?: unknown }
}
if (!globalWithConsole.console.Console) {
  globalWithConsole.console.Console = Console
}

const VALID_FLOW_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="${SF_NAMESPACE}">
    <apiVersion>67.0</apiVersion>
    <processType>AutoLaunchedFlow</processType>
    <start>
        <object>Account</object>
        <recordTriggerType>Create</recordTriggerType>
        <triggerType>RecordAfterSave</triggerType>
    </start>
    <status>Active</status>
</Flow>`

describe('FlowMutationRun Command', () => {
  let tempDir: string
  let tempFlowFile: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-cmd-test-'))
    tempFlowFile = path.join(tempDir, 'Account_Before.flow-meta.xml')
    await fs.writeFile(tempFlowFile, VALID_FLOW_XML, 'utf-8')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('has required summary, description and flags', () => {
    expect(FlowMutationRun.summary).toBeDefined()
    expect(FlowMutationRun.description).toBeDefined()
    expect(FlowMutationRun.flags.flow).toBeDefined()
    expect(FlowMutationRun.flags['flow-name']).toBeDefined()
    expect(FlowMutationRun.flags['flow-tests']).toBeDefined()
    expect(FlowMutationRun.flags['dry-run']).toBeDefined()
    expect(FlowMutationRun.flags['target-org']).toBeDefined()
    expect(FlowMutationRun.flags['test-apex']).toBeDefined()
  })

  it('normalizes -ta argument in init to --test-apex', async () => {
    const cmd = new FlowMutationRun(
      ['-f', tempFlowFile, '-ta', 'DiscountCalculatorTest', '-d'],
      {} as never
    )
    // Run protected init
    await (cmd as unknown as { init: () => Promise<void> }).init()
    expect((cmd as unknown as { argv: string[] }).argv).toContain('--test-apex')
    expect((cmd as unknown as { argv: string[] }).argv).not.toContain('-ta')
  })

  it('normalizes -ta= argument in init to --test-apex=', async () => {
    const cmd = new FlowMutationRun(
      ['-f', tempFlowFile, '-ta=DiscountCalculatorTest', '-d'],
      {} as never
    )
    await (cmd as unknown as { init: () => Promise<void> }).init()
    expect((cmd as unknown as { argv: string[] }).argv).toContain(
      '--test-apex=DiscountCalculatorTest'
    )
    expect((cmd as unknown as { argv: string[] }).argv).not.toContain(
      '-ta=DiscountCalculatorTest'
    )
  })

  it('normalizes -n and --flow-name argument in init to -f/--flow when -f is absent', async () => {
    const cmd1 = new FlowMutationRun(['-n', 'Account_After', '-d'], {} as never)
    await (cmd1 as unknown as { init: () => Promise<void> }).init()
    expect((cmd1 as unknown as { argv: string[] }).argv).toContain('-f')
    expect((cmd1 as unknown as { argv: string[] }).argv).not.toContain('-n')

    const cmd2 = new FlowMutationRun(['-n=Account_After', '-d'], {} as never)
    await (cmd2 as unknown as { init: () => Promise<void> }).init()
    expect((cmd2 as unknown as { argv: string[] }).argv).toContain(
      '-f=Account_After'
    )

    const cmd3 = new FlowMutationRun(
      ['--flow-name', 'Account_After', '-d'],
      {} as never
    )
    await (cmd3 as unknown as { init: () => Promise<void> }).init()
    expect((cmd3 as unknown as { argv: string[] }).argv).toContain('--flow')
    expect((cmd3 as unknown as { argv: string[] }).argv).not.toContain(
      '--flow-name'
    )

    const cmd4 = new FlowMutationRun(
      ['--flow-name=Account_After', '-d'],
      {} as never
    )
    await (cmd4 as unknown as { init: () => Promise<void> }).init()
    expect((cmd4 as unknown as { argv: string[] }).argv).toContain(
      '--flow=Account_After'
    )

    // When -f is already present, keeps --flow-name intact
    const cmd5 = new FlowMutationRun(
      ['-f', 'file.xml', '--flow-name', 'CustomName', '-d'],
      {} as never
    )
    await (cmd5 as unknown as { init: () => Promise<void> }).init()
    expect((cmd5 as unknown as { argv: string[] }).argv).toContain(
      '--flow-name'
    )
  })

  it('throws when target-org is missing and not dry-run', async () => {
    vi.spyOn(
      FlowMutationRun.prototype as unknown as {
        parse: () => Promise<unknown>
      },
      'parse'
    ).mockResolvedValueOnce({
      flags: {
        flow: tempFlowFile,
        'dry-run': false,
        'target-org': undefined,
      },
      args: {},
    })

    await expect(FlowMutationRun.run(['--flow', tempFlowFile])).rejects.toThrow(
      'Flag --target-org is required when not running with --dry-run.'
    )
  })

  it('runs successfully with target-org and reports score', async () => {
    vi.spyOn(
      FlowMutationRun.prototype as unknown as {
        parse: () => Promise<unknown>
      },
      'parse'
    ).mockResolvedValueOnce({
      flags: {
        flow: tempFlowFile,
        'dry-run': false,
        'target-org': {
          getUsername: () => 'test@example.com',
          getConnection: () => ({
            singleRecordQuery: vi.fn(),
            tooling: { sobject: vi.fn() },
          }),
        },
      },
      args: {},
    })

    vi.spyOn(FlowMutationOrchestrator.prototype, 'run').mockImplementationOnce(
      async options => {
        options.callbacks?.onValidating?.()
        options.callbacks?.onValidated?.()
        options.callbacks?.onBaselineDeploying?.()
        options.callbacks?.onBaselineDeployed?.()
        options.callbacks?.onBaselineTesting?.()
        options.callbacks?.onBaselineTested?.('Done')
        options.callbacks?.onMutantsGenerating?.()
        options.callbacks?.onMutantsGenerated?.(2)
        options.callbacks?.onTimeEstimate?.(1000, 2000, 2, 2)
        options.callbacks?.onProgressStart?.(2)
        options.callbacks?.onProgressUpdate?.(1, 'Testing mutant 1')
        options.callbacks?.onProgressFinish?.('Completed')
        options.callbacks?.onRollbackStarting?.()
        options.callbacks?.onRollbackFinished?.(false)
        options.callbacks?.onRollbackFinished?.(true)
        return {
          flowFilePath: tempFlowFile,
          totalMutants: 2,
          killed: 2,
          survived: 0,
          compileErrors: 0,
          mutationScore: 100,
          mutants: [
            {
              id: 'FLOW-MUT-1',
              mutatorName: 'RecordTriggerTypeMutator',
              elementName: '$Start',
              description: 'Changed recordTriggerType',
              originalSnippet: 'Create',
              mutatedSnippet: 'Update',
              mutatedXml: '<Flow/>',
              status: 'Killed',
              killedBy: ['Test1'],
            },
          ],
        }
      }
    )

    const result = await FlowMutationRun.run(['--flow', tempFlowFile])

    expect(result.score).toBe(100)
    expect(result.report.totalMutants).toBe(2)
  })

  it('runs successfully with test-apex flag and logs apex testing info', async () => {
    vi.spyOn(
      FlowMutationRun.prototype as unknown as {
        parse: () => Promise<unknown>
      },
      'parse'
    ).mockResolvedValueOnce({
      flags: {
        flow: tempFlowFile,
        'dry-run': false,
        'target-org': {
          getUsername: () => 'test@example.com',
          getConnection: () => ({
            singleRecordQuery: vi.fn(),
            tooling: { sobject: vi.fn() },
          }),
        },
        'test-apex': ['DiscountCalculatorTest'],
      },
      args: {},
    })

    vi.spyOn(FlowMutationOrchestrator.prototype, 'run').mockImplementationOnce(
      async options => {
        options.callbacks?.onBaselineTesting?.()
        return {
          flowFilePath: tempFlowFile,
          totalMutants: 1,
          killed: 1,
          survived: 0,
          compileErrors: 0,
          mutationScore: 100,
          mutants: [],
        }
      }
    )

    const result = await FlowMutationRun.run([
      '--flow',
      tempFlowFile,
      '--test-apex',
      'DiscountCalculatorTest',
    ])
    expect(result.score).toBe(100)
  })

  it('throws error when mutation score is below threshold', async () => {
    vi.spyOn(
      FlowMutationRun.prototype as unknown as {
        parse: () => Promise<unknown>
      },
      'parse'
    ).mockResolvedValueOnce({
      flags: {
        flow: tempFlowFile,
        'dry-run': false,
        threshold: 80,
        'target-org': {
          getUsername: () => 'test@example.com',
          getConnection: () => ({
            singleRecordQuery: vi.fn(),
            tooling: { sobject: vi.fn() },
          }),
        },
      },
      args: {},
    })

    vi.spyOn(FlowMutationOrchestrator.prototype, 'run').mockResolvedValueOnce({
      flowFilePath: tempFlowFile,
      totalMutants: 2,
      killed: 1,
      survived: 1,
      compileErrors: 0,
      mutationScore: 50,
      mutants: [],
    })

    await expect(
      FlowMutationRun.run(['--flow', tempFlowFile, '--threshold', '80'])
    ).rejects.toThrow('Mutation score 50% is below threshold 80%.')
  })

  it('runs successfully in dry-run mode and reports mutants with lines filter', async () => {
    const result = await FlowMutationRun.run([
      '--flow',
      tempFlowFile,
      '--lines',
      '5-8',
      '--dry-run',
    ])

    expect(result.score).toBeNull()
    expect(result.report.totalMutants).toBe(1)
    expect(result.report.mutants[0].status).toBe('Pending')
  })

  it('runs successfully in dry-run mode and reports mutants', async () => {
    const result = await FlowMutationRun.run([
      '--flow',
      tempFlowFile,
      '--dry-run',
    ])

    expect(result.score).toBeNull()
    expect(result.report.totalMutants).toBeGreaterThan(0)
    expect(result.report.mutants[0].status).toBe('Pending')
  })

  it('cleans up tempDir in finally block when tempDir is provided', async () => {
    const dummyTemp = await fs.mkdtemp(path.join(os.tmpdir(), 'dummy-temp-'))
    const tempFlow = path.join(dummyTemp, 'TempFlow.flow-meta.xml')
    await fs.writeFile(tempFlow, VALID_FLOW_XML, 'utf-8')

    vi.spyOn(FlowResolver, 'resolve').mockResolvedValueOnce({
      flowFilePath: tempFlow,
      flowDeveloperName: 'TempFlow',
      tempDir: dummyTemp,
    })

    vi.spyOn(
      FlowMutationRun.prototype as unknown as {
        parse: () => Promise<unknown>
      },
      'parse'
    ).mockResolvedValueOnce({
      flags: {
        flow: 'TempFlow',
        'dry-run': false,
        'target-org': {
          getUsername: () => 'test@example.com',
          getConnection: () => ({
            singleRecordQuery: vi.fn(),
            tooling: { sobject: vi.fn() },
          }),
        },
      },
      args: {},
    })

    vi.spyOn(FlowMutationOrchestrator.prototype, 'run').mockResolvedValueOnce({
      flowFilePath: tempFlow,
      totalMutants: 1,
      killed: 1,
      survived: 0,
      compileErrors: 0,
      mutationScore: 100,
      mutants: [],
    })

    const result = await FlowMutationRun.run(['--flow', 'TempFlow'])
    expect(result.score).toBe(100)

    let statErr: unknown = null
    try {
      await fs.stat(dummyTemp)
    } catch (e) {
      statErr = e
    }
    expect(statErr).toBeDefined()
  })

  it('handles error gracefully when tempDir cleanup fails', async () => {
    vi.spyOn(FlowResolver, 'resolve').mockResolvedValueOnce({
      flowFilePath: tempFlowFile,
      flowDeveloperName: 'Account_Before',
      tempDir: '/invalid/nonexistent/temp/path',
    })

    vi.spyOn(
      FlowMutationRun.prototype as unknown as {
        parse: () => Promise<unknown>
      },
      'parse'
    ).mockResolvedValueOnce({
      flags: {
        flow: 'Account_Before',
        'dry-run': false,
        'target-org': {
          getUsername: () => 'test@example.com',
          getConnection: () => ({
            singleRecordQuery: vi.fn(),
            tooling: { sobject: vi.fn() },
          }),
        },
      },
      args: {},
    })

    vi.spyOn(FlowMutationOrchestrator.prototype, 'run').mockResolvedValueOnce({
      flowFilePath: tempFlowFile,
      totalMutants: 1,
      killed: 1,
      survived: 0,
      compileErrors: 0,
      mutationScore: 100,
      mutants: [],
    })

    const result = await FlowMutationRun.run(['--flow', 'Account_Before'])
    expect(result.score).toBe(100)
  })
})
