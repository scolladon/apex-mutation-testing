import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockMessages = vi.hoisted(() => ({
  getMessage: vi.fn().mockReturnValue('mock message'),
  getMessages: vi.fn().mockReturnValue(['mock example']),
  createError: vi.fn().mockImplementation((...args: unknown[]) => {
    const key = args[0]
    const tokens = args[1] as string[] | undefined
    return new Error(`${key}: ${tokens?.join(', ')}`)
  }),
}))

vi.mock('@salesforce/core', () => ({
  Messages: {
    importMessagesDirectoryFromMetaUrl: vi.fn(),
    loadMessages: vi.fn().mockReturnValue(mockMessages),
  },
  Logger: {
    childFromRoot: vi.fn().mockReturnValue({
      shouldLog: vi.fn().mockReturnValue(false),
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    }),
  },
  LoggerLevel: {
    TRACE: 10,
    DEBUG: 20,
    INFO: 30,
    WARN: 40,
    ERROR: 50,
    FATAL: 60,
  },
  Connection: vi.fn(),
}))

vi.mock('@salesforce/sf-plugins-core', () => {
  class FakeSfCommand {
    progress = { start: vi.fn(), update: vi.fn(), finish: vi.fn() }
    spinner = { start: vi.fn(), stop: vi.fn() }
    log = vi.fn()
    info = vi.fn()
    parse = vi.fn()
    table = vi.fn()
    styledHeader = vi.fn()
  }

  return {
    SfCommand: FakeSfCommand,
    Flags: {
      // Echo the options back so the declaration itself is assertable; `parse`
      // is stubbed, so oclif never consumes these objects.
      string: vi.fn(options => options),
      boolean: vi.fn().mockReturnValue({}),
      directory: vi.fn().mockReturnValue({}),
      integer: vi.fn().mockReturnValue({}),
      file: vi.fn().mockReturnValue({}),
      requiredOrg: vi.fn().mockReturnValue({}),
      orgApiVersion: vi.fn().mockReturnValue({}),
    },
  }
})

vi.mock('../../src/service/apexClassValidator.js', () => ({
  ApexClassValidator: vi.fn(),
}))

vi.mock('../../src/service/mutationTestingService.js', () => ({
  MutationTestingService: vi.fn(),
}))

vi.mock('../../src/reporter/HTMLReporter.js', () => ({
  ApexMutationHTMLReporter: vi.fn(),
}))

const mockConfigReaderResolve = vi.hoisted(() => vi.fn())
vi.mock('../../src/service/configReader.js', () => ({
  ConfigReader: vi.fn().mockImplementation(
    class {
      resolve = mockConfigReaderResolve
    }
  ),
}))

const mockTestSuiteResolve = vi.hoisted(() => vi.fn())
vi.mock('../../src/service/testSuiteResolver.js', () => ({
  TestSuiteResolver: vi.fn().mockImplementation(
    class {
      resolve = mockTestSuiteResolve
    }
  ),
}))
vi.mock('../../src/adapter/apexTestSuiteRepository.js', () => ({
  ApexTestSuiteRepository: vi.fn(),
}))

import { default as ApexMutationTest } from '../../src/commands/apex/mutation/test/run.js'
import { ApexMutationHTMLReporter } from '../../src/reporter/HTMLReporter.js'
import { ApexClassValidator } from '../../src/service/apexClassValidator.js'
import { ConfigReader } from '../../src/service/configReader.js'
import { MutationTestingService } from '../../src/service/mutationTestingService.js'

describe('apex mutation test run NUT', () => {
  const mockConnection = {} as Record<string, unknown>
  const mockOrg = {
    getConnection: vi.fn().mockReturnValue(mockConnection),
  }

  beforeEach(() => {
    mockConfigReaderResolve.mockImplementation((...args: unknown[]) =>
      Promise.resolve(args[0])
    )
    mockTestSuiteResolve.mockImplementation((...args: unknown[]) =>
      Promise.resolve(args[0])
    )
    vi.mocked(ApexClassValidator).mockImplementation(
      class {
        validate = vi.fn().mockResolvedValue(undefined as never)
      }
    )
    vi.mocked(MutationTestingService).mockImplementation(
      class {
        process = vi.fn().mockResolvedValue({
          sourceFile: 'TestClass',
          sourceFileContent: 'class TestClass {}',
          testFiles: ['TestClassTest'],
          mutants: [{ status: 'Killed' }, { status: 'Survived' }],
        } as never)
        calculateScore = vi.fn().mockReturnValue(50)
      }
    )
    vi.mocked(ApexMutationHTMLReporter).mockImplementation(
      class {
        generateReport = vi.fn().mockResolvedValue(undefined as never)
      }
    )
  })

  // Mirrors oclif's `multiple: true, delimiter: ','` behaviour for a flag:
  // every occurrence contributes a value, each value is split on comma, and
  // an absent flag yields `undefined` — never `[]` — exactly like oclif's
  // own parser leaves an absent `multiple` flag with no default.
  function collectFlagValues(
    args: string[],
    names: string[]
  ): string[] | undefined {
    const rawValues = args.reduce<string[]>((values, arg, i) => {
      if (names.includes(arg)) {
        values.push(args[i + 1])
      }
      return values
    }, [])
    return rawValues.length === 0
      ? undefined
      : rawValues.flatMap(value => value.split(','))
  }

  async function runCommand(
    args: string[],
    flagOverrides: Record<string, unknown> = {}
  ) {
    const cmd = new ApexMutationTest(args, {} as never)
    ;(vi.spyOn(cmd as never, 'parse') as unknown as Mock).mockResolvedValue({
      flags: {
        'apex-class':
          args[args.indexOf('-c') + 1] ||
          args[args.indexOf('--apex-class') + 1],
        'test-class': collectFlagValues(args, ['-t', '--test-class']),
        'test-suite': collectFlagValues(args, ['--test-suite']),
        'report-dir': 'mutations',
        'target-org': mockOrg,
        ...flagOverrides,
      },
    } as never)
    vi.spyOn(cmd, 'log').mockImplementation(vi.fn() as never)
    vi.spyOn(cmd, 'info').mockImplementation(vi.fn() as never)
    Object.defineProperty(cmd, 'progress', {
      value: { start: vi.fn(), update: vi.fn(), finish: vi.fn() },
    })
    Object.defineProperty(cmd, 'spinner', {
      value: { start: vi.fn(), stop: vi.fn() },
    })
    return cmd.run()
  }

  async function runDryRunCommand(args: string[]) {
    return runCommand(args, { 'dry-run': true })
  }

  describe('Given valid flags, When running successfully', () => {
    let sut: { score: number }

    beforeEach(async () => {
      sut = (await runCommand([
        '-c',
        'MyClass',
        '-t',
        'MyClassTest',
      ])) as typeof sut
    })

    it('Then returns score', () => {
      expect(sut).toEqual({ score: 50 })
    })

    it('Then validates classes', () => {
      expect(ApexClassValidator).toHaveBeenCalledWith(mockConnection)
      const validatorInstance = vi.mocked(ApexClassValidator).mock.results[0]
        .value as { validate: ReturnType<typeof vi.fn> }
      expect(validatorInstance.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          apexClassName: 'MyClass',
          apexTestClassNames: ['MyClassTest'],
        })
      )
    })

    it('Then creates mutation service with correct params', () => {
      expect(MutationTestingService).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        mockConnection,
        expect.objectContaining({
          apexClassName: 'MyClass',
          apexTestClassNames: ['MyClassTest'],
          reportDir: 'mutations',
        }),
        expect.anything()
      )
    })

    it('Then generates HTML report', () => {
      expect(ApexMutationHTMLReporter).toHaveBeenCalled()
      const reporterInstance = vi.mocked(ApexMutationHTMLReporter).mock
        .results[0].value as { generateReport: ReturnType<typeof vi.fn> }
      expect(reporterInstance.generateReport).toHaveBeenCalled()
    })

    it('Then resolves config via ConfigReader', () => {
      expect(ConfigReader).toHaveBeenCalled()
      expect(mockConfigReaderResolve).toHaveBeenCalledWith(
        expect.objectContaining({
          apexClassName: 'MyClass',
          apexTestClassNames: ['MyClassTest'],
        })
      )
    })
  })

  // runCommand stubs `parse`, so the two cases below exercise the plumbing
  // downstream of parsing rather than oclif itself. This pins the flag
  // declaration that makes the repeated and comma-delimited forms parse at all —
  // without it, removing multiple/delimiter would leave the whole suite green.
  describe('Given the test-class flag declaration', () => {
    it('When inspected, Then it accepts repeated and comma-delimited values', () => {
      // Act
      const result = ApexMutationTest.flags['test-class']

      // Assert
      expect(result).toMatchObject({ multiple: true, delimiter: ',' })
    })

    it('When inspected, Then it is bound by atLeastOne and no longer required', () => {
      // Act
      const result = ApexMutationTest.flags['test-class']

      // Assert
      expect(result).toMatchObject({
        atLeastOne: ['test-class', 'test-suite'],
      })
      expect(result).not.toHaveProperty('required')
    })
  })

  describe('Given the test-suite flag declaration', () => {
    it('When inspected, Then it accepts repeated and comma-delimited values bound by atLeastOne', () => {
      // Act
      const result = ApexMutationTest.flags['test-suite']

      // Assert
      expect(result).toMatchObject({
        multiple: true,
        delimiter: ',',
        atLeastOne: ['test-class', 'test-suite'],
      })
    })
  })

  describe('Given the apex-class flag declaration', () => {
    it('When inspected, Then it remains required', () => {
      // Act
      const result = ApexMutationTest.flags['apex-class']

      // Assert
      expect(result).toMatchObject({ required: true })
    })
  })

  describe('Given multiple test classes via repeated -t flags', () => {
    it('When running, Then service receives apexTestClassNames in perimeter order', async () => {
      // Act
      await runCommand(['-c', 'MyClass', '-t', 'A', '-t', 'B'])

      // Assert
      expect(MutationTestingService).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        mockConnection,
        expect.objectContaining({ apexTestClassNames: ['A', 'B'] }),
        expect.anything()
      )
    })
  })

  describe('Given multiple test classes via a comma-delimited -t flag', () => {
    it('When running, Then service receives apexTestClassNames split on comma', async () => {
      // Act
      await runCommand(['-c', 'MyClass', '-t', 'A,B'])

      // Assert
      expect(MutationTestingService).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        mockConnection,
        expect.objectContaining({ apexTestClassNames: ['A', 'B'] }),
        expect.anything()
      )
    })
  })

  describe('Given a multi-class perimeter', () => {
    it('When running, Then info.CommandIsRunning receives the joined perimeter', async () => {
      // Act
      await runCommand(['-c', 'MyClass', '-t', 'A,B'])

      // Assert
      expect(mockMessages.getMessage).toHaveBeenCalledWith(
        'info.CommandIsRunning',
        ['MyClass', 'A, B']
      )
    })
  })

  describe('Given a suite-only invocation', () => {
    it('When running, Then ConfigReader resolves with an empty class list and the suite name', async () => {
      // Act
      await runCommand(['-c', 'MyClass', '--test-suite', 'MySuite'])

      // Assert
      expect(mockConfigReaderResolve).toHaveBeenCalledWith(
        expect.objectContaining({
          apexTestClassNames: [],
          apexTestSuiteNames: ['MySuite'],
        })
      )
    })
  })

  describe('Given a suite that expands the perimeter', () => {
    it('When running, Then the resolver sits between config resolution and validation and the running line names the resolved perimeter', async () => {
      // Arrange
      const configuredParameters = {
        apexClassName: 'MyClass',
        apexTestClassNames: ['MyClassTest'],
        apexTestSuiteNames: ['MySuite'],
        reportDir: 'mutations',
      }
      mockConfigReaderResolve.mockResolvedValue(configuredParameters)
      mockTestSuiteResolve.mockResolvedValue({
        ...configuredParameters,
        apexTestClassNames: ['MyClassTest', 'FromSuite'],
      })

      // Act
      await runCommand([
        '-c',
        'MyClass',
        '-t',
        'MyClassTest',
        '--test-suite',
        'MySuite',
      ])

      // Assert
      expect(mockTestSuiteResolve).toHaveBeenCalledWith(configuredParameters)
      const validatorInstance = vi.mocked(ApexClassValidator).mock.results[0]
        .value as { validate: ReturnType<typeof vi.fn> }
      expect(validatorInstance.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          apexTestClassNames: ['MyClassTest', 'FromSuite'],
        })
      )
      expect(MutationTestingService).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        mockConnection,
        expect.objectContaining({
          apexTestClassNames: ['MyClassTest', 'FromSuite'],
        }),
        expect.anything()
      )
      expect(mockMessages.getMessage).toHaveBeenCalledWith(
        'info.CommandIsRunning',
        ['MyClass', 'MyClassTest, FromSuite']
      )
    })
  })

  describe('Given no expansion should surface as new output', () => {
    it('When running with -t only vs -t and --test-suite, Then the message keys are identical in both normal and dry-run mode', async () => {
      // Act
      await runCommand(['-c', 'MyClass', '-t', 'A,B'])
      const classOnlyKeys = mockMessages.getMessage.mock.calls.map(
        call => call[0]
      )
      mockMessages.getMessage.mockClear()

      await runCommand(['-c', 'MyClass', '-t', 'A', '--test-suite', 'S'])
      const withSuiteKeys = mockMessages.getMessage.mock.calls.map(
        call => call[0]
      )
      mockMessages.getMessage.mockClear()

      await runDryRunCommand(['-c', 'MyClass', '-t', 'A,B'])
      const dryRunClassOnlyKeys = mockMessages.getMessage.mock.calls.map(
        call => call[0]
      )
      mockMessages.getMessage.mockClear()

      await runDryRunCommand(['-c', 'MyClass', '-t', 'A', '--test-suite', 'S'])
      const dryRunWithSuiteKeys = mockMessages.getMessage.mock.calls.map(
        call => call[0]
      )

      // Assert
      expect(withSuiteKeys).toEqual(classOnlyKeys)
      expect(dryRunWithSuiteKeys).toEqual(dryRunClassOnlyKeys)
    })
  })

  describe('Given validation fails', () => {
    it('When apex class is invalid, Then throws error', async () => {
      // Arrange
      vi.mocked(ApexClassValidator).mockImplementation(
        class {
          validate = vi
            .fn()
            .mockRejectedValue(new Error('InvalidClass not found') as never)
        }
      )

      // Act & Assert
      await expect(
        runCommand(['-c', 'InvalidClass', '-t', 'MyClassTest'])
      ).rejects.toThrow('InvalidClass not found')
    })

    it('When test class is invalid, Then throws error', async () => {
      // Arrange
      vi.mocked(ApexClassValidator).mockImplementation(
        class {
          validate = vi
            .fn()
            .mockRejectedValue(new Error('InvalidTest not found') as never)
        }
      )

      // Act & Assert
      await expect(
        runCommand(['-c', 'MyClass', '-t', 'InvalidTest'])
      ).rejects.toThrow('InvalidTest not found')
    })
  })

  describe('Given mutation service fails', () => {
    it('When process throws, Then propagates error', async () => {
      // Arrange
      vi.mocked(MutationTestingService).mockImplementation(
        class {
          process = vi
            .fn()
            .mockRejectedValue(new Error('No test coverage found') as never)
          calculateScore = vi.fn()
        }
      )

      // Act & Assert
      await expect(
        runCommand(['-c', 'MyClass', '-t', 'MyClassTest'])
      ).rejects.toThrow('No test coverage found')
    })
  })

  describe('Given dry-run flag', () => {
    beforeEach(() => {
      vi.mocked(MutationTestingService).mockImplementation(
        class {
          process = vi.fn().mockResolvedValue({
            sourceFile: 'MyClass',
            sourceFileContent: 'class MyClass {}',
            testFiles: ['MyClassTest'],
            mutants: [
              {
                id: 'MyClass-0',
                mutatorName: 'ArithmeticOperator',
                status: 'Pending',
                location: {
                  start: { line: 10, column: 1 },
                  end: { line: 10, column: 2 },
                },
                original: '+',
                replacement: '-',
              },
              {
                id: 'MyClass-1',
                mutatorName: 'BoundaryCondition',
                status: 'Pending',
                location: {
                  start: { line: 10, column: 5 },
                  end: { line: 10, column: 6 },
                },
                original: '<',
                replacement: '<=',
              },
              {
                id: 'MyClass-2',
                mutatorName: 'ArithmeticOperator',
                status: 'Pending',
                location: {
                  start: { line: 20, column: 1 },
                  end: { line: 20, column: 2 },
                },
                original: '*',
                replacement: '/',
              },
            ],
          } as never)
          calculateScore = vi.fn().mockReturnValue(null)
        }
      )
    })

    describe('When running with --dry-run', () => {
      let sut: { score: null }

      beforeEach(async () => {
        sut = (await runDryRunCommand([
          '-c',
          'MyClass',
          '-t',
          'MyClassTest',
          '-d',
        ])) as typeof sut
      })

      it('Then returns score as null', () => {
        expect(sut).toEqual({ score: null })
      })

      it('Then generates HTML report', () => {
        const mockInstance = vi.mocked(ApexMutationHTMLReporter).mock.results[0]
          .value as { generateReport: Mock }
        expect(mockInstance.generateReport).toHaveBeenCalled()
      })

      it('Then passes dryRun parameter to service', () => {
        expect(MutationTestingService).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          mockConnection,
          expect.objectContaining({
            apexClassName: 'MyClass',
            apexTestClassNames: ['MyClassTest'],
            dryRun: true,
          }),
          expect.anything()
        )
      })
    })
  })

  describe('Given threshold flag at or below score', () => {
    it('When running, Then does not throw', async () => {
      // Arrange — score=50, threshold=30: score >= threshold → no error

      // Act & Assert
      await expect(
        runCommand(['-c', 'MyClass', '-t', 'MyClassTest'], { threshold: 30 })
      ).resolves.not.toThrow()
    })
  })

  describe('Given threshold flag above score', () => {
    it('When running, Then throws threshold error', async () => {
      // Arrange
      vi.mocked(MutationTestingService).mockImplementation(
        class {
          process = vi.fn().mockResolvedValue({
            sourceFile: 'MyClass',
            sourceFileContent: 'class MyClass {}',
            testFiles: ['MyClassTest'],
            mutants: [{ status: 'Killed' }, { status: 'Survived' }],
          } as never)
          calculateScore = vi.fn().mockReturnValue(50)
        }
      )

      // Act & Assert
      await expect(
        runCommand(['-c', 'MyClass', '-t', 'MyClassTest'], { threshold: 80 })
      ).rejects.toThrow('error.thresholdNotMet')
      expect(mockMessages.createError).toHaveBeenCalledWith(
        'error.thresholdNotMet',
        ['50', '80']
      )
    })
  })

  describe('Given include-mutators flag', () => {
    it('When running, Then passes to MutationTestingService', async () => {
      // Arrange
      const includeMutators = ['ArithmeticOperator', 'BoundaryCondition']

      // Act
      await runCommand(['-c', 'MyClass', '-t', 'MyClassTest'], {
        'include-mutators': includeMutators,
      })

      // Assert
      expect(MutationTestingService).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        mockConnection,
        expect.objectContaining({
          includeMutators: ['ArithmeticOperator', 'BoundaryCondition'],
        }),
        expect.anything()
      )
    })
  })

  describe('Given config-file flag', () => {
    it('When running, Then ConfigReader resolves with config', async () => {
      // Arrange
      const configFile = '.mutation-testing.json'

      // Act
      await runCommand(['-c', 'MyClass', '-t', 'MyClassTest'], {
        'config-file': configFile,
      })

      // Assert
      expect(ConfigReader).toHaveBeenCalled()
      expect(mockConfigReaderResolve).toHaveBeenCalledWith(
        expect.objectContaining({
          configFile: '.mutation-testing.json',
        })
      )
    })
  })

  describe('Given exclude-mutators flag', () => {
    it('When running, Then passes to MutationTestingService', async () => {
      // Arrange
      const excludeMutators = ['ArithmeticOperator']

      // Act
      await runCommand(['-c', 'MyClass', '-t', 'MyClassTest'], {
        'exclude-mutators': excludeMutators,
      })

      // Assert
      expect(MutationTestingService).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        mockConnection,
        expect.objectContaining({
          excludeMutators: ['ArithmeticOperator'],
        }),
        expect.anything()
      )
    })
  })

  describe('Given exclude-test-methods flag', () => {
    it('When running, Then passes to MutationTestingService', async () => {
      // Arrange
      const excludeTestMethods = ['testSlowMethod']

      // Act
      await runCommand(['-c', 'MyClass', '-t', 'MyClassTest'], {
        'exclude-test-methods': excludeTestMethods,
      })

      // Assert
      expect(MutationTestingService).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        mockConnection,
        expect.objectContaining({
          excludeTestMethods: ['testSlowMethod'],
        }),
        expect.anything()
      )
    })
  })

  describe('Given skip-patterns flag', () => {
    it('When running, Then passes to MutationTestingService', async () => {
      // Arrange
      const skipPatterns = ['System\\.debug']

      // Act
      await runCommand(['-c', 'MyClass', '-t', 'MyClassTest'], {
        'skip-patterns': skipPatterns,
      })

      // Assert
      expect(MutationTestingService).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        mockConnection,
        expect.objectContaining({
          skipPatterns: ['System\\.debug'],
        }),
        expect.anything()
      )
    })
  })
})
