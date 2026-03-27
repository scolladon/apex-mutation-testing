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
      string: vi.fn().mockReturnValue({}),
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
          testFile: 'TestClassTest',
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
        'test-class':
          args[args.indexOf('-t') + 1] ||
          args[args.indexOf('--test-class') + 1],
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
      // biome-ignore lint/suspicious/noExplicitAny: mock instance access
      const validatorInstance = (ApexClassValidator as any).mock.results[0]
        .value
      expect(validatorInstance.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          apexClassName: 'MyClass',
          apexTestClassName: 'MyClassTest',
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
          apexTestClassName: 'MyClassTest',
          reportDir: 'mutations',
        }),
        expect.anything()
      )
    })

    it('Then generates HTML report', () => {
      expect(ApexMutationHTMLReporter).toHaveBeenCalled()
      // biome-ignore lint/suspicious/noExplicitAny: mock instance access
      const reporterInstance = (ApexMutationHTMLReporter as any).mock.results[0]
        .value
      expect(reporterInstance.generateReport).toHaveBeenCalled()
    })

    it('Then resolves config via ConfigReader', () => {
      expect(ConfigReader).toHaveBeenCalled()
      expect(mockConfigReaderResolve).toHaveBeenCalledWith(
        expect.objectContaining({
          apexClassName: 'MyClass',
          apexTestClassName: 'MyClassTest',
        })
      )
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
            testFile: 'MyClassTest',
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
            apexTestClassName: 'MyClassTest',
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
            testFile: 'MyClassTest',
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
})
