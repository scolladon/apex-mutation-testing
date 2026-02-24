const mockMessages = {
  getMessage: jest.fn().mockReturnValue('mock message'),
  getMessages: jest.fn().mockReturnValue(['mock example']),
}

jest.mock('@salesforce/core', () => ({
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

jest.mock('@salesforce/sf-plugins-core', () => {
  class FakeSfCommand {
    progress = { start: jest.fn(), update: jest.fn(), finish: jest.fn() }
    spinner = { start: jest.fn(), stop: jest.fn() }
    log = jest.fn()
    info = jest.fn()
    parse = jest.fn()
  }

  return {
    SfCommand: FakeSfCommand,
    Flags: {
      string: jest.fn().mockReturnValue({}),
      directory: jest.fn().mockReturnValue({}),
      requiredOrg: jest.fn().mockReturnValue({}),
      orgApiVersion: jest.fn().mockReturnValue({}),
    },
  }
})

jest.mock('../../src/service/apexClassValidator.js')
jest.mock('../../src/service/mutationTestingService.js')
jest.mock('../../src/reporter/HTMLReporter.js')

import ApexMutationTest from '../../src/commands/apex/mutation/test/run.js'
import { ApexMutationHTMLReporter } from '../../src/reporter/HTMLReporter.js'
import { ApexClassValidator } from '../../src/service/apexClassValidator.js'
import { MutationTestingService } from '../../src/service/mutationTestingService.js'

describe('apex mutation test run NUT', () => {
  const mockConnection = {} as Record<string, unknown>
  const mockOrg = {
    getConnection: jest.fn().mockReturnValue(mockConnection),
  }

  beforeEach(() => {
    ;(ApexClassValidator as jest.Mock).mockImplementation(() => ({
      validate: jest.fn().mockResolvedValue(undefined),
    }))
    ;(MutationTestingService as jest.Mock).mockImplementation(() => ({
      process: jest.fn().mockResolvedValue({
        sourceFile: 'TestClass',
        sourceFileContent: 'class TestClass {}',
        testFile: 'TestClassTest',
        mutants: [{ status: 'Killed' }, { status: 'Survived' }],
      }),
      calculateScore: jest.fn().mockReturnValue(50),
    }))
    ;(ApexMutationHTMLReporter as jest.Mock).mockImplementation(() => ({
      generateReport: jest.fn().mockResolvedValue(undefined),
    }))
  })

  async function runCommand(args: string[]) {
    const cmd = new ApexMutationTest(args, {} as never)
    jest.spyOn(cmd as never, 'parse').mockResolvedValue({
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
    jest.spyOn(cmd, 'log').mockImplementation()
    jest.spyOn(cmd, 'info').mockImplementation()
    Object.defineProperty(cmd, 'progress', {
      value: { start: jest.fn(), update: jest.fn(), finish: jest.fn() },
    })
    Object.defineProperty(cmd, 'spinner', {
      value: { start: jest.fn(), stop: jest.fn() },
    })
    return cmd.run()
  }

  describe('Given valid flags', () => {
    it('When running successfully, Then returns score', async () => {
      // Act
      const sut = await runCommand(['-c', 'MyClass', '-t', 'MyClassTest'])

      // Assert
      expect(sut).toEqual({ score: 50 })
    })

    it('When running successfully, Then validates classes', async () => {
      // Act
      await runCommand(['-c', 'MyClass', '-t', 'MyClassTest'])

      // Assert
      expect(ApexClassValidator).toHaveBeenCalledWith(mockConnection)
      const validatorInstance = (ApexClassValidator as jest.Mock).mock
        .results[0].value
      expect(validatorInstance.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          apexClassName: 'MyClass',
          apexTestClassName: 'MyClassTest',
        })
      )
    })

    it('When running successfully, Then creates mutation service with correct params', async () => {
      // Act
      await runCommand(['-c', 'MyClass', '-t', 'MyClassTest'])

      // Assert
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

    it('When running successfully, Then generates HTML report', async () => {
      // Act
      await runCommand(['-c', 'MyClass', '-t', 'MyClassTest'])

      // Assert
      expect(ApexMutationHTMLReporter).toHaveBeenCalled()
      const reporterInstance = (ApexMutationHTMLReporter as jest.Mock).mock
        .results[0].value
      expect(reporterInstance.generateReport).toHaveBeenCalled()
    })
  })

  describe('Given validation fails', () => {
    it('When apex class is invalid, Then throws error', async () => {
      // Arrange
      ;(ApexClassValidator as jest.Mock).mockImplementation(() => ({
        validate: jest
          .fn()
          .mockRejectedValue(new Error('InvalidClass not found')),
      }))

      // Act & Assert
      await expect(
        runCommand(['-c', 'InvalidClass', '-t', 'MyClassTest'])
      ).rejects.toThrow('InvalidClass not found')
    })

    it('When test class is invalid, Then throws error', async () => {
      // Arrange
      ;(ApexClassValidator as jest.Mock).mockImplementation(() => ({
        validate: jest
          .fn()
          .mockRejectedValue(new Error('InvalidTest not found')),
      }))

      // Act & Assert
      await expect(
        runCommand(['-c', 'MyClass', '-t', 'InvalidTest'])
      ).rejects.toThrow('InvalidTest not found')
    })
  })

  describe('Given mutation service fails', () => {
    it('When process throws, Then propagates error', async () => {
      // Arrange
      ;(MutationTestingService as jest.Mock).mockImplementation(() => ({
        process: jest
          .fn()
          .mockRejectedValue(new Error('No test coverage found')),
        calculateScore: jest.fn(),
      }))

      // Act & Assert
      await expect(
        runCommand(['-c', 'MyClass', '-t', 'MyClassTest'])
      ).rejects.toThrow('No test coverage found')
    })
  })
})
