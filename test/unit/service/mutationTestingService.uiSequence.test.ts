import { Connection, Messages } from '@salesforce/core'
import {
  ApexClassRepository,
  DeploymentFailedError,
} from '../../../src/adapter/org/apexClassRepository.js'
import { ApexSettingsRepository } from '../../../src/adapter/org/apexSettingsRepository.js'
import { ApexTestRunner } from '../../../src/adapter/org/apexTestRunner.js'
import type { ApexTestSuiteRepository } from '../../../src/adapter/org/apexTestSuiteRepository.js'
import type { MetadataComponentDependency } from '../../../src/adapter/org/MetadataComponentDependency.js'
import { OrgApexSourceProvider } from '../../../src/adapter/org/orgApexSourceProvider.js'
import { OrgMutationTestBed } from '../../../src/adapter/org/orgMutationTestBed.js'
import { OrgSObjectSchemaProvider } from '../../../src/adapter/org/orgSObjectSchemaProvider.js'
import type { EngineBundle } from '../../../src/port/executionEngine.js'
import { reportEngineNotice } from '../../../src/service/engineNotice.js'
import { MutantGenerator } from '../../../src/service/mutantGenerator.js'
import { MutationTestingService } from '../../../src/service/mutationTestingService.js'
import {
  formatDuration,
  formatRemainingTime,
  timeExecution,
} from '../../../src/service/timeUtils.js'
import { TypeDiscoverer } from '../../../src/service/typeDiscoverer.js'
import { ApexMutation } from '../../../src/type/ApexMutation.js'
import { ApexMutationParameter } from '../../../src/type/ApexMutationParameter.js'
import { recordUiCalls, type UiRecorder } from '../../utils/testUtil.js'

// This file characterises the behaviour of MutationTestingService.process()
// as an ordered sequence of spinner/progress/sink invocations. Every array
// below was captured from a real run against the code as it stood before the
// execution ports were extracted, never hand-written, and must never be
// edited by a later refactor — an edit to one of these arrays is the signal
// that behaviour moved, not a chore.
//
// Known blind spot, stated here because it bounds what a green run proves:
// the recorder's spinner and progress are plain stubs, so these arrays pin the
// ordered sequence of CALLS, never what a terminal rendered. A textless
// `spinner.stop:` entry is the clearest case — oclif prints its default 'done'
// when a task is active and prints nothing when none is, and the recorder
// cannot tell those apart, so no array here pins a user-visible word for one.
// A bug that manifests only as a swallowed line is therefore invisible to this
// instrument; the end-to-end run is the only check of rendering, and it is not
// a terminal snapshot either.

// Partial mock — a full automock replaces DeploymentFailedError with a stub
// that no longer extends Error. GroupExecutor's classifyError still needs the
// real class even though no path recorded here deliberately triggers it.
vi.mock('../../../src/adapter/org/apexClassRepository.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/adapter/org/apexClassRepository.js')
  >('../../../src/adapter/org/apexClassRepository.js')
  return { ...actual, ApexClassRepository: vi.fn() }
})
vi.mock('../../../src/adapter/org/apexSettingsRepository.js')
vi.mock('../../../src/adapter/org/apexTestRunner.js')
vi.mock('../../../src/adapter/org/orgSObjectSchemaProvider.js')
vi.mock('../../../src/service/mutantGenerator.js')
vi.mock('../../../src/service/typeDiscoverer.js')
vi.mock('../../../src/service/timeUtils.js')
vi.mock('../../../src/service/typeMatcher.js')

const mockTypeRegistry = {}
const mockAnalyzeFullResult = {
  typeRegistry: mockTypeRegistry,
  tree: {} as never,
  tokenStream: {} as never,
}

const baselineResult = (overrides: Record<string, unknown> = {}) => ({
  outcome: 'Passed',
  testsRan: 1,
  compileFailures: [],
  otherFailureCount: 0,
  testMethodsPerLine: new Map(),
  ...overrides,
})

const mockApexClass = {
  Id: '123',
  Name: 'TestClass',
  Body: 'class TestClass { public static Integer getValue() { return 42; } }',
}

const mockTestClass = {
  Id: '456',
  Name: 'TestClassTest',
  Body: '@IsTest class TestClassTest { @IsTest static void test() {} }',
}

const mockMutation: ApexMutation = {
  mutationName: 'TestMutation',
  replacement: '0',
  target: {
    startToken: {
      line: 1,
      charPositionInLine: 60,
      tokenIndex: 5,
      startIndex: 60,
      stopIndex: 61,
      text: '42',
    } as ApexMutation['target']['startToken'],
    endToken: {
      line: 1,
      charPositionInLine: 60,
      tokenIndex: 5,
      startIndex: 60,
      stopIndex: 61,
      text: '42',
    } as ApexMutation['target']['endToken'],
    text: '42',
  },
}

// A second mutation on a distinct line with a disjoint covering test —
// exercised only by the grouping-on path (path 3), which needs two
// mutations DSATUR can pack into a single conflict-free group.
const mockMutation2: ApexMutation = {
  mutationName: 'TestMutation2',
  replacement: '1',
  target: {
    startToken: {
      line: 2,
      charPositionInLine: 10,
      tokenIndex: 8,
      startIndex: 10,
      stopIndex: 11,
      text: '1',
    } as ApexMutation['target']['startToken'],
    endToken: {
      line: 2,
      charPositionInLine: 10,
      tokenIndex: 8,
      startIndex: 10,
      stopIndex: 11,
      text: '1',
    } as ApexMutation['target']['endToken'],
    text: '1',
  },
}

type UpdateImpl = () => Promise<unknown>

const alwaysResolves: UpdateImpl = () => Promise.resolve({})

// Resolves the first two calls (compile verify, then a mutant deploy) and
// rejects from the third call onward (the rollback attempt) — path 8's
// "loop throws, rollback also throws" fixture.
const resolvesTwiceThenRejects = (): UpdateImpl => {
  let calls = 0
  return () => {
    calls += 1
    return calls <= 2
      ? Promise.resolve({})
      : Promise.reject(new Error('rollback network down'))
  }
}

// Succeeds once (the first mutant's deploy body), then throws on the second
// call — path 8's "mutateMany returns once then throws" fixture.
// mutateMany runs ahead of the deploy call inside GroupExecutor and is not
// wrapped in a try/catch there, so this throw is what makes the loop itself
// reject.
const mutateManyReturnsOnceThenThrows = (): (() => string) => {
  let calls = 0
  return () => {
    calls += 1
    if (calls === 1) return 'mutated code'
    throw new Error('mutateMany boom')
  }
}

// Resolves the compile verify, then fails the grouped mutant deploy and both
// singleton retries with a compile failure, then resolves the rollback. This
// is the fixture for the one control-flow path the port extraction inverted:
// a mutant that does not compile is now a returned verdict rather than a
// thrown error, and for a group of two that verdict is what sends the loop
// into its singleton fallback.
const compileFailsForEveryMutantDeploy = (): UpdateImpl => {
  let calls = 0
  return () => {
    calls += 1
    return calls === 1 || calls > 4
      ? Promise.resolve({})
      : Promise.reject(
          new DeploymentFailedError(
            'Deployment failed:\n[classes/TestClass.cls:1:1] Expression cannot be a statement.'
          )
        )
  }
}

const arrangeApexClassRepository = (update: UpdateImpl): void => {
  vi.mocked(ApexClassRepository).mockImplementation(
    class {
      read = vi
        .fn()
        .mockImplementation((name: string) =>
          name === 'TestClass'
            ? Promise.resolve(mockApexClass)
            : Promise.resolve(mockTestClass)
        )
      update = vi.fn().mockImplementation(update)
      getApexClassDependencies = vi
        .fn()
        .mockResolvedValue([] as MetadataComponentDependency[])
    }
  )
}

const arrangeMutantGenerator = (
  mutations: ApexMutation[],
  mutateMany: () => string = () => 'mutated code'
): void => {
  vi.mocked(MutantGenerator).mockImplementation(
    class {
      compute = vi.fn().mockReturnValue({ mutations, tokenStream: {} })
      mutate = vi.fn().mockReturnValue('mutated code')
      mutateMany = vi.fn().mockImplementation(mutateMany)
    }
  )
}

const arrangeApexTestRunner = (
  baseline: ReturnType<typeof baselineResult>,
  runTestMethods: () => Promise<unknown> = () =>
    Promise.resolve({ outcome: 'Passed' })
): void => {
  vi.mocked(ApexTestRunner).mockImplementation(
    class {
      getTestMethodsPerLines = vi.fn().mockResolvedValue(baseline)
      runTestMethods = vi.fn().mockImplementation(runTestMethods)
    }
  )
}

const arrangeApexSettingsRepository = (
  isAggregateCoverageOnly: boolean
): void => {
  vi.mocked(ApexSettingsRepository).mockImplementation(
    class {
      isAggregateCoverageOnly = vi
        .fn()
        .mockResolvedValue(isAggregateCoverageOnly)
    }
  )
}

describe('MutationTestingService — golden UI-call sequence', () => {
  let connection: Connection
  let messagesMock: Messages<string>

  // Builds the bundle the way createOrgEngine does: one shared
  // ApexClassRepository, one ApexTestRunner whose onSyncFallback composes
  // ctx.notify with reportEngineNotice exactly as run.ts wires it, and the
  // real OrgApexSourceProvider/OrgMutationTestBed driving the mocked
  // low-level adapters configured by each test's arrange helpers below.
  const buildEngine = (ui: UiRecorder, apexClassName: string): EngineBundle => {
    const repository = new ApexClassRepository(connection)
    const runner = new ApexTestRunner(connection, {
      onSyncFallback: error =>
        reportEngineNotice(
          { kind: 'sync-transport-fallback', error },
          ui.spinner,
          messagesMock,
          ui.sink
        ),
    })
    const settings = new ApexSettingsRepository(connection)
    return {
      source: new OrgApexSourceProvider(
        repository,
        {} as unknown as ApexTestSuiteRepository
      ),
      schema: new OrgSObjectSchemaProvider(connection),
      testBed: new OrgMutationTestBed(
        repository,
        runner,
        settings,
        apexClassName
      ),
    }
  }

  const buildSut = (
    ui: UiRecorder,
    overrides: Partial<ApexMutationParameter> = {}
  ): MutationTestingService => {
    const apexClassName = overrides.apexClassName ?? 'TestClass'
    return new MutationTestingService(
      ui.progress,
      ui.spinner,
      buildEngine(ui, apexClassName),
      {
        apexClassName,
        apexTestClassNames: ['TestClassTest'],
        ...overrides,
      } as ApexMutationParameter,
      messagesMock,
      ui.sink
    )
  }

  beforeEach(() => {
    connection = {} as Connection

    const resolveMessageTemplate = (key: string, args?: string[]): string => {
      const templates: Record<string, string> = {
        'error.noCoverage': `No test coverage found for '${args?.[0]}'. Ensure '${args?.[1]}' tests exercise the code you want to mutation test.`,
        'error.noMutations': `No mutations could be generated for '${args?.[0]}'. ${args?.[1]} line(s) covered but no mutable patterns found.`,
        'error.compilabilityCheckFailed': `The Apex class '${args?.[0]}' does not compile on the target org. Fix compilation errors before running mutation testing.\nError: ${args?.[1]}`,
        'info.timeEstimate': `Estimated time: ${args?.[0]}`,
        'info.timeEstimateBreakdown': `Deploy: ${args?.[0]}/mutant | Test: ${args?.[1]}/mutant | Mutants: ${args?.[2]}`,
        'info.aggregatedCoverageOnly':
          'aggregate coverage mode — all tests run per mutant and score may be understated',
        'info.testClassNotUsable': `Skipping test class '${args?.[0]}'${args?.[1]}: ${args?.[2]}.`,
        'info.contributedBySuite': `(contributed by test suite ${args?.[0]})`,
        'info.reasonNoCoverage': 'it contributed no covered lines',
        'info.reasonDoesNotCompile': `it does not compile${args?.[0] ?? ''}`,
        'error.noUsableTestClass': `No usable Apex test class remains in the perimeter for '${args?.[0]}'. The following test class(es) were skipped:\n${args?.[1]}`,
        'info.syncTransportFallback': `Synchronous test execution is unavailable (${args?.[0]}). Falling back to the asynchronous transport.`,
        'info.groupingPlan': `Mutation grouping enabled — packed ${args?.[0]} mutations into ${args?.[1]} group(s) (${args?.[2]}% fewer deployments, lower bound ${args?.[3]})${args?.[4]}`,
        'info.groupingFallback': `Group of ${args?.[0]} mutations failed batch deploy — re-evaluating individually`,
      }
      return templates[key] || key
    }

    messagesMock = {
      getMessage: vi.fn(resolveMessageTemplate),
      createError: vi.fn(
        (key: string, tokens?: string[]) =>
          new Error(resolveMessageTemplate(key, tokens))
      ),
    } as unknown as Messages<string>

    vi.mocked(OrgSObjectSchemaProvider).mockImplementation(
      class {
        describe = vi.fn().mockResolvedValue(undefined)
      }
    )

    vi.mocked(TypeDiscoverer).mockImplementation(
      class {
        withMatcher = vi.fn().mockReturnThis()
        analyze = vi.fn().mockResolvedValue(mockTypeRegistry)
        analyzeFull = vi.fn().mockResolvedValue(mockAnalyzeFullResult)
      }
    )

    vi.mocked(timeExecution).mockImplementation(
      async (fn: () => Promise<unknown>) => {
        const result = await fn()
        return { result, durationMs: 5000 }
      }
    )
    vi.mocked(formatDuration).mockReturnValue('~5s')
    vi.mocked(formatRemainingTime).mockReturnValue('Remaining: ~5s | ')

    arrangeApexSettingsRepository(false)
  })

  it('Given per-test fidelity with grouping off, When a mutant is deployed and killed, Then the UI call sequence matches the recorded golden array', async () => {
    // Arrange
    const ui = recordUiCalls()
    arrangeApexClassRepository(alwaysResolves)
    arrangeMutantGenerator([mockMutation])
    arrangeApexTestRunner(
      baselineResult({
        testMethodsPerLine: new Map([
          [1, new Set(['TestClassTest.testMethodA'])],
        ]),
      }),
      () =>
        Promise.resolve({
          outcome: 'Failed',
          tests: [
            {
              className: 'TestClassTest',
              methodName: 'testMethodA',
              outcome: 'Fail',
            },
          ],
        })
    )
    const sut = buildSut(ui)

    // Act
    await sut.process()

    // Assert
    expect(ui.calls).toEqual([
      'spinner.start:Fetching "TestClass" ApexClass content',
      'spinner.stop:Done',
      'spinner.start:Analyzing class dependencies for "TestClass"',
      'spinner.stop:Done',
      'spinner.start:Verifying "TestClass" apex class compilation',
      'spinner.stop:Done',
      'spinner.start:Executing "TestClassTest" tests to get coverage',
      'spinner.stop:Original tests passed',
      'spinner.start:Generating mutants for "TestClass" ApexClass',
      'spinner.stop:1 mutations generated',
      'spinner.start:Estimated time: ~5s',
      'spinner.stop:Deploy: ~5s/mutant | Test: ~5s/mutant | Mutants: 1',
      'progress.start:1|Starting mutation testing',
      'progress.update:0|Remaining: ~5s | Deploying "0" mutation at line 1',
      'progress.update:0|Remaining: ~5s | Running 1 tests methods for "0" mutation at line 1',
      'progress.update:1|Remaining: ~5s | Mutation result: mutant killed',
      'progress.finish:All mutations evaluated',
      'spinner.start:Rolling back "TestClass" ApexClass to its original state',
      'spinner.stop:Done',
    ])
  })

  it('Given aggregate fidelity, When processing completes, Then the UI call sequence matches the recorded golden array', async () => {
    // Arrange
    const ui = recordUiCalls()
    arrangeApexSettingsRepository(true)
    arrangeApexClassRepository(alwaysResolves)
    arrangeMutantGenerator([mockMutation])
    arrangeApexTestRunner(
      baselineResult({
        testMethodsPerLine: new Map([
          [1, new Set(['TestClassTest.testMethodA'])],
        ]),
      }),
      () =>
        Promise.resolve({
          outcome: 'Failed',
          tests: [
            {
              className: 'TestClassTest',
              methodName: 'testMethodA',
              outcome: 'Fail',
            },
          ],
        })
    )
    const sut = buildSut(ui)

    // Act
    await sut.process()

    // Assert
    expect(ui.calls).toEqual([
      'spinner.start:Fetching "TestClass" ApexClass content',
      'spinner.stop:Done',
      'spinner.start:Analyzing class dependencies for "TestClass"',
      'spinner.stop:Done',
      'spinner.start:Verifying "TestClass" apex class compilation',
      'spinner.stop:Done',
      'spinner.start:Executing "TestClassTest" tests to get coverage',
      'spinner.stop:Original tests passed (aggregate coverage mode — all tests run per mutant and score may be understated)',
      'spinner.start:Generating mutants for "TestClass" ApexClass',
      'spinner.stop:1 mutations generated',
      'spinner.start:Estimated time: ~5s',
      'spinner.stop:Deploy: ~5s/mutant | Test: ~5s/mutant | Mutants: 1',
      'progress.start:1|Starting mutation testing',
      'progress.update:0|Remaining: ~5s | Deploying "0" mutation at line 1',
      'progress.update:0|Remaining: ~5s | Running 1 tests methods for "0" mutation at line 1',
      'progress.update:1|Remaining: ~5s | Mutation result: mutant killed',
      'progress.finish:All mutations evaluated',
      'spinner.start:Rolling back "TestClass" ApexClass to its original state',
      'spinner.stop:Done',
    ])
  })

  it('Given mutation grouping enabled with two disjoint mutations, When processing completes, Then the UI call sequence matches the recorded golden array', async () => {
    // Arrange
    const ui = recordUiCalls()
    arrangeApexClassRepository(alwaysResolves)
    arrangeMutantGenerator([mockMutation, mockMutation2])
    arrangeApexTestRunner(
      baselineResult({
        testMethodsPerLine: new Map([
          [1, new Set(['TestClassTest.testMethodA'])],
          [2, new Set(['TestClassTest.testMethodB'])],
        ]),
      }),
      () =>
        Promise.resolve({
          outcome: 'Failed',
          tests: [
            {
              className: 'TestClassTest',
              methodName: 'testMethodA',
              outcome: 'Fail',
            },
            {
              className: 'TestClassTest',
              methodName: 'testMethodB',
              outcome: 'Pass',
            },
          ],
        })
    )
    const sut = buildSut(ui, { mutationGrouping: true })

    // Act
    await sut.process()

    // Assert
    expect(ui.calls).toEqual([
      'spinner.start:Fetching "TestClass" ApexClass content',
      'spinner.stop:Done',
      'spinner.start:Analyzing class dependencies for "TestClass"',
      'spinner.stop:Done',
      'spinner.start:Verifying "TestClass" apex class compilation',
      'spinner.stop:Done',
      'spinner.start:Executing "TestClassTest" tests to get coverage',
      'spinner.stop:Original tests passed',
      'spinner.start:Generating mutants for "TestClass" ApexClass',
      'spinner.stop:2 mutations generated',
      'spinner.start:Grouping 2 mutations to minimize deployments',
      'spinner.stop:Mutation grouping enabled — packed 2 mutations into 1 group(s) (50% fewer deployments, lower bound 1) — exact: confirmed optimal',
      'spinner.start:Estimated time: ~5s',
      'spinner.stop:Deploy: ~5s/mutant | Test: ~5s/mutant | Mutants: 2',
      'progress.start:2|Starting mutation testing',
      'progress.update:0|Remaining: ~5s | Evaluating 2 mutations on lines 1, 2',
      'progress.update:2|Remaining: ~5s | Group of 2 evaluated: 1 killed, 1 survived',
      'progress.finish:All mutations evaluated',
      'spinner.start:Rolling back "TestClass" ApexClass to its original state',
      'spinner.stop:Done',
    ])
  })

  it('Given a packed group whose mutant deploy does not compile, When the loop falls back to singletons, Then the UI call sequence matches the recorded golden array', async () => {
    // Arrange
    const ui = recordUiCalls()
    arrangeApexClassRepository(compileFailsForEveryMutantDeploy())
    arrangeMutantGenerator([mockMutation, mockMutation2])
    arrangeApexTestRunner(
      baselineResult({
        testMethodsPerLine: new Map([
          [1, new Set(['TestClassTest.testMethodA'])],
          [2, new Set(['TestClassTest.testMethodB'])],
        ]),
      })
    )
    const sut = buildSut(ui, { mutationGrouping: true })

    // Act
    await sut.process()

    // Assert
    expect(ui.calls).toEqual([
      'spinner.start:Fetching "TestClass" ApexClass content',
      'spinner.stop:Done',
      'spinner.start:Analyzing class dependencies for "TestClass"',
      'spinner.stop:Done',
      'spinner.start:Verifying "TestClass" apex class compilation',
      'spinner.stop:Done',
      'spinner.start:Executing "TestClassTest" tests to get coverage',
      'spinner.stop:Original tests passed',
      'spinner.start:Generating mutants for "TestClass" ApexClass',
      'spinner.stop:2 mutations generated',
      'spinner.start:Grouping 2 mutations to minimize deployments',
      'spinner.stop:Mutation grouping enabled — packed 2 mutations into 1 group(s) (50% fewer deployments, lower bound 1) — exact: confirmed optimal',
      'spinner.start:Estimated time: ~5s',
      'spinner.stop:Deploy: ~5s/mutant | Test: ~5s/mutant | Mutants: 2',
      'progress.start:2|Starting mutation testing',
      'progress.update:0|Remaining: ~5s | Evaluating 2 mutations on lines 1, 2',
      'progress.update:0|Group of 2 mutations failed batch deploy — re-evaluating individually',
      'progress.update:2|Remaining: ~5s | Fallback for group of 2 complete',
      'progress.finish:All mutations evaluated',
      'spinner.start:Rolling back "TestClass" ApexClass to its original state',
      'spinner.stop:Done',
    ])
  })

  it('Given dry-run mode, When processing completes, Then the UI call sequence matches the recorded golden array', async () => {
    // Arrange
    const ui = recordUiCalls()
    arrangeApexClassRepository(alwaysResolves)
    arrangeMutantGenerator([mockMutation])
    arrangeApexTestRunner(
      baselineResult({
        testMethodsPerLine: new Map([
          [1, new Set(['TestClassTest.testMethodA'])],
        ]),
      })
    )
    const sut = buildSut(ui, { dryRun: true })

    // Act
    await sut.process()

    // Assert
    expect(ui.calls).toEqual([
      'spinner.start:Fetching "TestClass" ApexClass content',
      'spinner.stop:Done',
      'spinner.start:Analyzing class dependencies for "TestClass"',
      'spinner.stop:Done',
      'spinner.start:Verifying "TestClass" apex class compilation',
      'spinner.stop:Done',
      'spinner.start:Executing "TestClassTest" tests to get coverage',
      'spinner.stop:Original tests passed',
      'spinner.start:Generating mutants for "TestClass" ApexClass',
      'spinner.stop:1 mutations generated',
      'spinner.start:Estimated time: ~5s',
      'spinner.stop:Deploy: ~5s/mutant | Test: ~5s/mutant | Mutants: 1',
    ])
  })

  it('Given the compilability verify deploy rejects, When processing runs, Then the UI call sequence matches the recorded golden array', async () => {
    // Arrange
    const ui = recordUiCalls()
    arrangeApexClassRepository(() => Promise.reject(new Error('compile boom')))
    const sut = buildSut(ui)

    // Act
    await expect(sut.process()).rejects.toThrow()

    // Assert
    expect(ui.calls).toEqual([
      'spinner.start:Fetching "TestClass" ApexClass content',
      'spinner.stop:Done',
      'spinner.start:Analyzing class dependencies for "TestClass"',
      'spinner.stop:Done',
      'spinner.start:Verifying "TestClass" apex class compilation',
      'spinner.stop:',
    ])
  })

  it('Given a two-class perimeter where one class fails to compile, When processing completes, Then the UI call sequence matches the recorded golden array', async () => {
    // Arrange
    const ui = recordUiCalls()
    arrangeApexClassRepository(alwaysResolves)
    arrangeMutantGenerator([mockMutation])
    arrangeApexTestRunner(
      baselineResult({
        testsRan: 2,
        compileFailures: [{ className: 'TestClassTest', message: 'boom' }],
        testMethodsPerLine: new Map([[1, new Set(['GoodTest.testMethodA'])]]),
      })
    )
    const sut = buildSut(ui, {
      apexTestClassNames: ['TestClassTest', 'GoodTest'],
    })

    // Act
    await sut.process()

    // Assert
    expect(ui.calls).toEqual([
      'spinner.start:Fetching "TestClass" ApexClass content',
      'spinner.stop:Done',
      'spinner.start:Analyzing class dependencies for "TestClass"',
      'spinner.stop:Done',
      'spinner.start:Verifying "TestClass" apex class compilation',
      'spinner.stop:Done',
      'spinner.start:Executing "TestClassTest, GoodTest" tests to get coverage',
      'spinner.stop:Original tests passed',
      "spinner.start:Skipping test class 'TestClassTest': it does not compile (boom).",
      'spinner.stop:',
      'spinner.start:Generating mutants for "TestClass" ApexClass',
      'spinner.stop:1 mutations generated',
      'spinner.start:Estimated time: ~5s',
      'spinner.stop:Deploy: ~5s/mutant | Test: ~5s/mutant | Mutants: 1',
      'progress.start:1|Starting mutation testing',
      'progress.update:0|Remaining: ~5s | Deploying "0" mutation at line 1',
      'progress.update:0|Remaining: ~5s | Running 1 tests methods for "0" mutation at line 1',
      'progress.update:1|Remaining: ~5s | Mutation result: zombie',
      'progress.finish:All mutations evaluated',
      'spinner.start:Rolling back "TestClass" ApexClass to its original state',
      'spinner.stop:Done',
    ])
  })

  it('Given every perimeter class fails to compile, When processing runs, Then the UI call sequence matches the recorded golden array', async () => {
    // Arrange
    const ui = recordUiCalls()
    arrangeApexClassRepository(alwaysResolves)
    arrangeApexTestRunner(
      baselineResult({
        compileFailures: [{ className: 'TestClassTest', message: 'boom' }],
        testMethodsPerLine: new Map(),
      })
    )
    const sut = buildSut(ui)

    // Act
    await expect(sut.process()).rejects.toThrow()

    // Assert
    expect(ui.calls).toEqual([
      'spinner.start:Fetching "TestClass" ApexClass content',
      'spinner.stop:Done',
      'spinner.start:Analyzing class dependencies for "TestClass"',
      'spinner.stop:Done',
      'spinner.start:Verifying "TestClass" apex class compilation',
      'spinner.stop:Done',
      'spinner.start:Executing "TestClassTest" tests to get coverage',
      'spinner.stop:',
      "spinner.start:Skipping test class 'TestClassTest': it does not compile (boom).",
      'spinner.stop:',
    ])
  })

  it('Given the mutation loop throws and the rollback deploy also rejects, When processing runs, Then the UI call sequence matches the recorded golden array', async () => {
    // Arrange
    const ui = recordUiCalls()
    arrangeApexClassRepository(resolvesTwiceThenRejects())
    arrangeMutantGenerator(
      [{ ...mockMutation }, { ...mockMutation }],
      mutateManyReturnsOnceThenThrows()
    )
    arrangeApexTestRunner(
      baselineResult({
        testMethodsPerLine: new Map([
          [1, new Set(['TestClassTest.testMethodA'])],
        ]),
      })
    )
    const sut = buildSut(ui)

    // Act
    await expect(sut.process()).rejects.toThrow()

    // Assert
    expect(ui.calls).toEqual([
      'spinner.start:Fetching "TestClass" ApexClass content',
      'spinner.stop:Done',
      'spinner.start:Analyzing class dependencies for "TestClass"',
      'spinner.stop:Done',
      'spinner.start:Verifying "TestClass" apex class compilation',
      'spinner.stop:Done',
      'spinner.start:Executing "TestClassTest" tests to get coverage',
      'spinner.stop:Original tests passed',
      'spinner.start:Generating mutants for "TestClass" ApexClass',
      'spinner.stop:2 mutations generated',
      'spinner.start:Estimated time: ~5s',
      'spinner.stop:Deploy: ~5s/mutant | Test: ~5s/mutant | Mutants: 2',
      'progress.start:2|Starting mutation testing',
      'progress.update:0|Remaining: ~5s | Deploying "0" mutation at line 1',
      'progress.update:0|Remaining: ~5s | Running 1 tests methods for "0" mutation at line 1',
      'progress.update:1|Remaining: ~5s | Mutation result: zombie',
      'progress.update:1|Remaining: ~5s | Deploying "0" mutation at line 1',
      'progress.update:1|Remaining: ~5s | Running 1 tests methods for "0" mutation at line 1',
      'progress.stop',
      'spinner.start:Rolling back "TestClass" ApexClass to its original state',
      "spinner.stop:Rollback FAILED — 'TestClass' remains in a mutated state on the target org. Redeploy the original class manually.",
    ])
  })

  it('Given the adapter reports a synchronous transport fallback, When onSyncFallback fires after the baseline aborts, Then the UI call sequence matches the recorded golden array', async () => {
    // Arrange
    const ui = recordUiCalls()
    arrangeApexClassRepository(alwaysResolves)
    arrangeApexTestRunner(
      baselineResult({ outcome: 'Failed', otherFailureCount: 1, testsRan: 1 })
    )
    const sut = buildSut(ui)

    // Act
    await expect(sut.process()).rejects.toThrow()
    // createAdapters passed onSyncFallback as ApexTestRunner's second
    // constructor argument; driving it directly proves the wiring without
    // needing a live sync-transport failure inside this arrangement.
    const [, options] = vi.mocked(ApexTestRunner).mock.calls[0] as [
      unknown,
      { onSyncFallback?: (error: Error) => void },
    ]
    options.onSyncFallback?.(new Error('View Setup permission required'))

    // Assert
    expect(ui.calls).toEqual([
      'spinner.start:Fetching "TestClass" ApexClass content',
      'spinner.stop:Done',
      'spinner.start:Analyzing class dependencies for "TestClass"',
      'spinner.stop:Done',
      'spinner.start:Verifying "TestClass" apex class compilation',
      'spinner.stop:Done',
      'spinner.start:Executing "TestClassTest" tests to get coverage',
      'spinner.stop:',
      'spinner.pause',
      'sink:Synchronous test execution is unavailable (View Setup permission required). Falling back to the asynchronous transport.\n',
    ])
  })
})
