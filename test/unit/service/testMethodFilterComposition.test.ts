import { readFile } from 'node:fs/promises'

import { Messages } from '@salesforce/core'
import { Progress, Spinner } from '@salesforce/sf-plugins-core'
import type { EngineBundle } from '../../../src/port/executionEngine.js'
import { ConfigReader } from '../../../src/service/configReader.js'
import { MutantGenerator } from '../../../src/service/mutantGenerator.js'
import { MutationTestingService } from '../../../src/service/mutationTestingService.js'
import { TypeDiscoverer } from '../../../src/service/typeDiscoverer.js'
import { ApexMutationParameter } from '../../../src/type/ApexMutationParameter.js'
import type { TestClassResolutions } from '../../../src/type/TestClassResolution.js'
import {
  fakeSchemaProvider,
  fakeSourceProvider,
  fakeTestBed,
} from '../../utils/testUtil.js'

vi.mock('node:fs/promises')
vi.mock('../../../src/service/mutantGenerator.js')
vi.mock('../../../src/service/typeDiscoverer.js')

// ConfigReader and MutationTestingService were each individually green while
// contradicting each other: ConfigReader used to strip a namespace-qualified
// test-method filter down to two segments, while MutationTestingService's
// matchesFilter resolves a filter entry through a class's lookupKeys, which
// hold only the qualified spelling for a foreign class (a bare spelling is
// legal source only inside the namespace that owns it). Nothing composed the
// two, so `--include-test-methods mockery.ArgumentTest.testFoo` shipped
// selecting zero methods and dying on error.noCoverage. This suite runs the
// real ConfigReader.resolve output into a real MutationTestingService to pin
// the user-typed spelling actually survives the filter end to end.
describe('ConfigReader output composed with MutationTestingService test-method filtering', () => {
  const CLASS_ID_FOREIGN = '01pjV000000EE9bQAG'
  const resolutions: TestClassResolutions = new Map([
    [
      CLASS_ID_FOREIGN,
      {
        classId: CLASS_ID_FOREIGN,
        displayName: 'mockery.ArgumentTest',
        // A foreign row never mints a bare key — a bare spelling is legal
        // source only inside the namespace that owns it, so the qualified
        // spelling is this row's only lookup key.
        lookupKeys: ['mockery.argumenttest'],
      },
    ],
  ])

  const mockApexClass = {
    Id: '123',
    Name: 'TestClass',
    Body: 'class TestClass { public static Integer getValue() { return 42; } }',
  }

  const mockMutation = {
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
      },
      endToken: {
        line: 1,
        charPositionInLine: 60,
        tokenIndex: 5,
        startIndex: 60,
        stopIndex: 61,
        text: '42',
      },
      text: '42',
    },
  }

  let progress: Progress
  let spinner: Spinner
  let messagesMock: Messages<string>

  beforeEach(() => {
    // Arrange — no config file on disk, so ConfigReader.resolve only ever
    // reflects the CLI-supplied parameter.
    vi.mocked(readFile).mockRejectedValue({ code: 'ENOENT' })

    progress = {
      start: vi.fn(),
      update: vi.fn(),
      finish: vi.fn(),
      stop: vi.fn(),
    } as unknown as Progress
    spinner = {
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn((fn: () => void) => fn()),
    } as unknown as Spinner
    messagesMock = {
      getMessage: vi.fn((key: string) => key),
      createError: vi.fn((key: string) => new Error(key)),
    } as unknown as Messages<string>

    vi.mocked(MutantGenerator).mockImplementation(
      class {
        compute = vi
          .fn()
          .mockReturnValue({ mutations: [mockMutation], tokenStream: {} })
        mutate = vi.fn().mockReturnValue('mutated code')
      } as unknown as typeof MutantGenerator
    )
    vi.mocked(TypeDiscoverer).mockImplementation(
      class {
        withMatcher = vi.fn().mockReturnThis()
        analyzeFull = vi.fn().mockResolvedValue({
          typeRegistry: {},
          tree: {} as never,
          tokenStream: {} as never,
        })
      } as unknown as typeof TypeDiscoverer
    )
  })

  it('Given includeTestMethods holds a user-typed three-segment qualified spelling, When ConfigReader.resolve output is processed by MutationTestingService, Then the method survives the filter and a mutant is produced', async () => {
    // Arrange
    const parameter: ApexMutationParameter = {
      apexClassName: 'TestClass',
      apexTestClassNames: ['mockery.ArgumentTest'],
      includeTestMethods: ['mockery.ArgumentTest.testFoo'],
      reportDir: 'reports',
    }
    const configReader = new ConfigReader(messagesMock)
    const resolvedParameters = await configReader.resolve(parameter)

    const engine: EngineBundle = {
      source: fakeSourceProvider({
        readClass: vi.fn().mockResolvedValue(mockApexClass),
      }),
      schema: fakeSchemaProvider(),
      testBed: fakeTestBed({
        outcome: 'Passed',
        testsRan: 1,
        testMethodsPerLine: new Map([
          [1, new Set([`${CLASS_ID_FOREIGN}.testFoo`])],
        ]),
      }),
    }

    const sut = new MutationTestingService(
      progress,
      spinner,
      engine,
      {
        ...resolvedParameters,
        testClassResolutions: resolutions,
      },
      messagesMock
    )

    // Act
    const result = await sut.process()

    // Assert — the class was not dropped, so mutation generation proceeded.
    expect(result.mutants).toHaveLength(1)
  })
})
