import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockMessages = {
  getMessage: jest.fn().mockReturnValue('mock message'),
  getMessages: jest.fn().mockReturnValue(['mock example']),
}

jest.unstable_mockModule('@salesforce/core', () => ({
  Messages: {
    importMessagesDirectoryFromMetaUrl: jest.fn(),
    loadMessages: jest.fn().mockReturnValue(mockMessages),
  },
  Logger: {
    childFromRoot: jest.fn().mockReturnValue({
      shouldLog: jest.fn().mockReturnValue(false),
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
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
  Connection: jest.fn(),
}))

jest.unstable_mockModule('@salesforce/sf-plugins-core', () => {
  class FakeSfCommand {
    progress = { start: jest.fn(), update: jest.fn(), finish: jest.fn() }
    spinner = { start: jest.fn(), stop: jest.fn() }
    log = jest.fn()
    info = jest.fn()
    parse = jest.fn()
    table = jest.fn()
    styledHeader = jest.fn()
  }

  return {
    SfCommand: FakeSfCommand,
    Flags: {
      string: jest.fn().mockReturnValue({}),
      boolean: jest.fn().mockReturnValue({}),
      directory: jest.fn().mockReturnValue({}),
      requiredOrg: jest.fn().mockReturnValue({}),
      orgApiVersion: jest.fn().mockReturnValue({}),
    },
  }
})

jest.unstable_mockModule('../../src/service/apexClassValidator.js', () => ({
  ApexClassValidator: jest.fn(),
}))

jest.unstable_mockModule('../../src/service/mutationTestingService.js', () => ({
  MutationTestingService: jest.fn(),
}))

jest.unstable_mockModule('../../src/reporter/HTMLReporter.js', () => ({
  ApexMutationHTMLReporter: jest.fn(),
}))

const { default: ApexMutationTest } = await import(
  '../../src/commands/apex/mutation/test/run.js'
)
const { ApexMutationHTMLReporter } = await import(
  '../../src/reporter/HTMLReporter.js'
)
const { ApexClassValidator } = await import(
  '../../src/service/apexClassValidator.js'
)
const { MutationTestingService } = await import(
  '../../src/service/mutationTestingService.js'
)

describe('apex mutation test run NUT', () => {
  const mockConnection = {} as Record<string, unknown>
  const mockOrg = {
    getConnection: jest.fn().mockReturnValue(mockConnection),
  }

  beforeEach(() => {
    ;(ApexClassValidator as jest.Mock<() => unknown>).mockImplementation(
      () => ({
        validate: jest.fn().mockResolvedValue(undefined as never),
      })
    )
    ;(MutationTestingService as jest.Mock<() => unknown>).mockImplementation(
      () => ({
        process: jest.fn().mockResolvedValue({
          sourceFile: 'TestClass',
          sourceFileContent: 'class TestClass {}',
          testFile: 'TestClassTest',
          mutants: [{ status: 'Killed' }, { status: 'Survived' }],
        } as never),
        calculateScore: jest.fn().mockReturnValue(50),
      })
    )
    ;(ApexMutationHTMLReporter as jest.Mock<() => unknown>).mockImplementation(
      () => ({
        generateReport: jest.fn().mockResolvedValue(undefined as never),
      })
    )
  })

  async function runCommand(args: string[]) {
    const cmd = new ApexMutationTest(args, {} as never)
    ;(
      jest.spyOn(cmd as never, 'parse') as unknown as jest.Mock
    ).mockResolvedValue({
      flags: {
        'apex-class':
          args[args.indexOf('-c') + 1] ||
          args[args.indexOf('--apex-class') + 1],
        'test-class':
          args[args.indexOf('-t') + 1] ||
          args[args.indexOf('--test-class') + 1],
        'report-dir': 'mutations',
        'target-org': mockOrg,
      },
    } as never)
    jest.spyOn(cmd, 'log').mockImplementation(jest.fn() as never)
    jest.spyOn(cmd, 'info').mockImplementation(jest.fn() as never)
    Object.defineProperty(cmd, 'progress', {
      value: { start: jest.fn(), update: jest.fn(), finish: jest.fn() },
    })
    Object.defineProperty(cmd, 'spinner', {
      value: { start: jest.fn(), stop: jest.fn() },
    })
    return cmd.run()
  }

  async function runDryRunCommand(args: string[]) {
    const cmd = new ApexMutationTest(args, {} as never)
    ;(
      jest.spyOn(cmd as never, 'parse') as unknown as jest.Mock
    ).mockResolvedValue({
      flags: {
        'apex-class':
          args[args.indexOf('-c') + 1] ||
          args[args.indexOf('--apex-class') + 1],
        'test-class':
          args[args.indexOf('-t') + 1] ||
          args[args.indexOf('--test-class') + 1],
        'report-dir': 'mutations',
        'target-org': mockOrg,
        'dry-run': true,
      },
    } as never)
    jest.spyOn(cmd, 'log').mockImplementation(jest.fn() as never)
    jest.spyOn(cmd, 'info').mockImplementation(jest.fn() as never)
    Object.defineProperty(cmd, 'progress', {
      value: { start: jest.fn(), update: jest.fn(), finish: jest.fn() },
    })
    Object.defineProperty(cmd, 'spinner', {
      value: { start: jest.fn(), stop: jest.fn() },
    })
    return cmd.run()
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
  })

  describe('Given validation fails', () => {
    it('When apex class is invalid, Then throws error', async () => {
      // Arrange
      ;(ApexClassValidator as jest.Mock<() => unknown>).mockImplementation(
        () => ({
          validate: jest
            .fn()
            .mockRejectedValue(new Error('InvalidClass not found') as never),
        })
      )

      // Act & Assert
      await expect(
        runCommand(['-c', 'InvalidClass', '-t', 'MyClassTest'])
      ).rejects.toThrow('InvalidClass not found')
    })

    it('When test class is invalid, Then throws error', async () => {
      // Arrange
      ;(ApexClassValidator as jest.Mock<() => unknown>).mockImplementation(
        () => ({
          validate: jest
            .fn()
            .mockRejectedValue(new Error('InvalidTest not found') as never),
        })
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
      ;(MutationTestingService as jest.Mock<() => unknown>).mockImplementation(
        () => ({
          process: jest
            .fn()
            .mockRejectedValue(new Error('No test coverage found') as never),
          calculateScore: jest.fn(),
        })
      )

      // Act & Assert
      await expect(
        runCommand(['-c', 'MyClass', '-t', 'MyClassTest'])
      ).rejects.toThrow('No test coverage found')
    })
  })

  describe('Given dry-run flag', () => {
    beforeEach(() => {
      ;(MutationTestingService as jest.Mock<() => unknown>).mockImplementation(
        () => ({
          process: jest.fn().mockResolvedValue({
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
          } as never),
          calculateScore: jest.fn().mockReturnValue(null),
        })
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
        const mockInstance = (
          ApexMutationHTMLReporter as jest.Mock<() => unknown>
        ).mock.results[0].value as { generateReport: jest.Mock }
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
})
