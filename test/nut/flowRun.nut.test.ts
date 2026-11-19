import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createOrgFlowEngine } from '../../src/adapter/org/orgEngine.js'
import FlowMutationRun from '../../src/commands/apex/mutation/flow/run.js'
import type { FlowEngineBundle } from '../../src/port/executionEngine.js'
import {
  FlowLeftoverVersionError,
  FlowRestoreError,
  ProductionOrgError,
} from '../../src/port/flowErrors.js'
import type { FlowTestBed } from '../../src/port/flowTestBed.js'
import { flowTestXml, recordTriggeredFlowXml } from '../utils/flowFixtures.js'

// Command-level: the real command, orchestrator, mutators and reporter, over
// fake org ports — everything above src/port/ runs as shipped.
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
      requiredOrg: vi.fn().mockReturnValue({}),
      orgApiVersion: vi.fn().mockReturnValue({}),
    },
  }
})
vi.mock('../../src/adapter/org/orgEngine.js', () => ({
  createOrgFlowEngine: vi.fn(),
}))

type Command = FlowMutationRun & {
  parse: ReturnType<typeof vi.fn>
  log: ReturnType<typeof vi.fn>
  spinner: { start: ReturnType<typeof vi.fn> }
}

describe('apex mutation flow run (NUT)', () => {
  let cwd: string
  let localFlow: string
  let testBed: { [K in keyof FlowTestBed]: ReturnType<typeof vi.fn> }
  const originalXml = recordTriggeredFlowXml('Active')

  const command = (flags: Record<string, unknown> = {}): Command => {
    const sut = new (FlowMutationRun as unknown as new () => Command)()
    sut.parse.mockResolvedValue({
      flags: {
        flow: 'Account_After',
        'report-dir': 'mutations',
        'dry-run': false,
        'target-org': { getConnection: () => ({}) },
        ...flags,
      },
    })
    return sut
  }

  beforeEach(async () => {
    cwd = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'flow-nut-'))
    )
    await fs.mkdir(path.join(cwd, 'mutations'))
    localFlow = path.join(
      cwd,
      'force-app',
      'main',
      'default',
      'flows',
      'Account_After.flow-meta.xml'
    )
    await fs.mkdir(path.dirname(localFlow), { recursive: true })
    await fs.writeFile(localFlow, originalXml)
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)

    testBed = {
      prepare: vi.fn().mockResolvedValue({
        testsRan: 1,
        failingTests: [],
        cost: { applyMs: 10, runMs: 10 },
      }),
      evaluate: vi.fn(),
      needsRestore: vi.fn().mockReturnValue(true),
      restore: vi.fn().mockResolvedValue(undefined),
    }
    const engine: FlowEngineBundle = {
      source: {
        readFlow: vi.fn().mockResolvedValue({
          apiName: 'Account_After',
          xml: originalXml,
          tests: [
            { fullName: 'Sets_Rating', xml: flowTestXml('Account_After') },
          ],
        }),
      },
      testBed: testBed as unknown as FlowTestBed,
    }
    vi.mocked(createOrgFlowEngine).mockResolvedValue(engine)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(cwd, { recursive: true, force: true })
  })

  it('Given a run in progress, When a mutant is under test, Then the local source file is untouched', async () => {
    // Arrange — review proof: the org, not the project, is the run's source
    const onDisk: string[] = []
    testBed.evaluate.mockImplementation(async () => {
      onDisk.push(await fs.readFile(localFlow, 'utf-8'))
      return { kind: 'executed', failingTests: ['Sets_Rating'] }
    })

    // Act
    const result = await command().run()

    // Assert
    expect(onDisk).toEqual([originalXml])
    expect(await fs.readFile(localFlow, 'utf-8')).toBe(originalXml)
    expect(result).toEqual({ score: 100 })
    const report = await fs.readFile(
      path.join(cwd, 'mutations', 'index.html'),
      'utf8'
    )
    expect(report).toContain('Account_After.flow-meta.xml')
  })

  it('Given every mutant surviving, When run, Then the score is 0 and nothing is warned: the test bed proves which version ran', async () => {
    // Arrange
    testBed.evaluate.mockResolvedValue({ kind: 'executed', failingTests: [] })
    const sut = command()

    // Act
    const result = await sut.run()

    // Assert
    expect(result).toEqual({ score: 0 })
    expect(sut.warn).not.toHaveBeenCalled()
  })

  it('Given a dry run, When run, Then the report is written and the org is never prepared', async () => {
    // Act
    const result = await command({ 'dry-run': true }).run()

    // Assert
    expect(result).toEqual({ score: null })
    expect(testBed.prepare).not.toHaveBeenCalled()
    await expect(
      fs.stat(path.join(cwd, 'mutations', 'index.html'))
    ).resolves.toBeDefined()
  })

  it('Given a production org, When run, Then the command refuses with the bundle message, dry runs included', async () => {
    // Arrange
    vi.mocked(createOrgFlowEngine).mockRejectedValue(new ProductionOrgError())

    // Act & Assert
    await expect(command({ 'dry-run': true }).run()).rejects.toThrow(
      'The target org is not a sandbox, a scratch org or a Developer Edition org.'
    )
  })

  it('Given a failed restore, When run, Then the command fails and writes no report', async () => {
    // Arrange
    testBed.evaluate.mockResolvedValue({
      kind: 'executed',
      failingTests: ['t'],
    })
    testBed.restore.mockRejectedValue(
      new FlowRestoreError('Account_After', [new Error('org down')])
    )

    // Act & Assert
    await expect(command().run()).rejects.toThrow(
      "Flow 'Account_After' and its FlowTests could not be fully restored: org down."
    )
    await expect(
      fs.stat(path.join(cwd, 'mutations', 'index.html'))
    ).rejects.toThrow()
  })

  it('Given a refusal before any write, When run, Then the bundle message is shown and no restore is announced', async () => {
    // Arrange
    testBed.prepare.mockRejectedValue(
      new FlowLeftoverVersionError('Account_After', [2])
    )
    testBed.needsRestore.mockReturnValue(false)
    const sut = command()

    // Act & Assert
    await expect(sut.run()).rejects.toThrow(
      "Flow 'Account_After' has versions marked [apex-mutation-testing] (2)"
    )
    expect(testBed.restore).not.toHaveBeenCalled()
    expect(
      sut.spinner.start.mock.calls.some(([text]) =>
        String(text).startsWith('Restoring')
      )
    ).toBe(false)
  })
})
