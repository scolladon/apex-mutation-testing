import type { ApexClassRepository } from '../../../../src/adapter/org/apexClassRepository.js'
import {
  DeploymentFailedError,
  PollTimeoutError,
} from '../../../../src/adapter/org/apexClassRepository.js'
import type { ApexSettingsRepository } from '../../../../src/adapter/org/apexSettingsRepository.js'
import type { ApexTestRunner } from '../../../../src/adapter/org/apexTestRunner.js'
import { OrgMutationTestBed } from '../../../../src/adapter/org/orgMutationTestBed.js'
import { CompilationCheckFailedError } from '../../../../src/port/mutationTestBed.js'
import {
  AggregateCoverageStrategy,
  PerTestCoverageStrategy,
} from '../../../../src/service/coverageStrategy.js'
import { timeExecution } from '../../../../src/service/timeUtils.js'
import type { ApexClass } from '../../../../src/type/ApexClass.js'

vi.mock('../../../../src/service/timeUtils.js')

const mockOriginal: ApexClass = { Id: '123', Body: 'class Foo {}' }
// 18-character org Id, deliberately shaped nothing like the class name so a
// mutant passing the name instead of the Id is caught.
const TARGET_CLASS_ID = '01pjV000000EE9ZQAW'

const baselineTestResult = {
  outcome: 'Passed',
  testsRan: 1,
  compileFailures: [],
  otherFailureCount: 0,
  testMethodsPerLine: new Map(),
}

// Records hook order the same way MutationTestingService's arrangement does,
// so a test can assert both "which hooks fired" and "in which order".
const recordingHooks = () => {
  const calls: string[] = []
  return {
    calls,
    hooks: {
      onVerifying: vi.fn(() => calls.push('onVerifying')),
      onVerified: vi.fn(() => calls.push('onVerified')),
      onBaselineStarting: vi.fn(() => calls.push('onBaselineStarting')),
    },
  }
}

describe('OrgMutationTestBed', () => {
  let repository: { update: ReturnType<typeof vi.fn> }
  let runner: {
    getTestMethodsPerLines: ReturnType<typeof vi.fn>
    runTestMethods: ReturnType<typeof vi.fn>
  }
  let settings: { isAggregateCoverageOnly: ReturnType<typeof vi.fn> }
  let sut: OrgMutationTestBed

  beforeEach(() => {
    repository = { update: vi.fn().mockResolvedValue({}) }
    runner = {
      getTestMethodsPerLines: vi.fn().mockResolvedValue(baselineTestResult),
      runTestMethods: vi
        .fn()
        .mockResolvedValue({ outcome: 'Passed', tests: [] }),
    }
    settings = { isAggregateCoverageOnly: vi.fn().mockResolvedValue(false) }
    sut = new OrgMutationTestBed(
      repository as unknown as ApexClassRepository,
      runner as unknown as ApexTestRunner,
      settings as unknown as ApexSettingsRepository
    )

    let call = 0
    vi.mocked(timeExecution).mockImplementation(async fn => {
      call += 1
      const result = await fn()
      return { result, durationMs: call === 1 ? 11 : 22 }
    })
  })

  describe('prepare', () => {
    it('Given a compiling class and per-test coverage, When prepare runs, Then the hooks fire in order and the baseline carries per-test fidelity and bracketed cost', async () => {
      // Arrange
      const { hooks, calls } = recordingHooks()

      // Act
      const result = await sut.prepare(mockOriginal, ['TestClassTest'], hooks)

      // Assert
      expect(calls).toEqual(['onVerifying', 'onVerified', 'onBaselineStarting'])
      expect(repository.update).toHaveBeenCalledWith(mockOriginal)
      expect(settings.isAggregateCoverageOnly).toHaveBeenCalled()
      expect(runner.getTestMethodsPerLines).toHaveBeenCalledWith(
        ['TestClassTest'],
        expect.any(PerTestCoverageStrategy)
      )
      expect(result).toEqual({
        ...baselineTestResult,
        fidelity: 'per-test',
        cost: { applyMs: 11, runMs: 22 },
      })
    })

    it('Given a resolved class Id, When prepare runs, Then the coverage strategy is built from that Id and not from any name', async () => {
      // Arrange — Body and the perimeter entry are name-shaped so a mutant
      // that threads a name into the strategy instead of the Id is caught.
      const { hooks } = recordingHooks()
      const resolvedClass: ApexClass = {
        Id: TARGET_CLASS_ID,
        Body: 'class MutationTest {}',
      }

      // Act
      await sut.prepare(resolvedClass, ['MutationTestTest'], hooks)

      // Assert
      const strategyArg = runner.getTestMethodsPerLines.mock.calls[0][1]
      expect(strategyArg).toBeInstanceOf(PerTestCoverageStrategy)
      const { targetClassId } = strategyArg as { targetClassId: string }
      expect(targetClassId).toBe(TARGET_CLASS_ID)
    })

    it('Given the org settings enable aggregate coverage only, When prepare runs, Then the baseline carries aggregate fidelity', async () => {
      // Arrange
      settings.isAggregateCoverageOnly.mockResolvedValue(true)
      const { hooks } = recordingHooks()

      // Act
      const result = await sut.prepare(mockOriginal, ['TestClassTest'], hooks)

      // Assert
      expect(runner.getTestMethodsPerLines).toHaveBeenCalledWith(
        ['TestClassTest'],
        expect.any(AggregateCoverageStrategy)
      )
      expect(result.fidelity).toBe('aggregate')
    })

    it('Given the compile deploy rejects with an Error, When prepare runs, Then it throws CompilationCheckFailedError carrying that error and never proceeds to the baseline', async () => {
      // Arrange
      const reason = new Error('compile boom')
      repository.update.mockRejectedValue(reason)
      const { hooks } = recordingHooks()

      // Act & Assert
      const caught = await sut
        .prepare(mockOriginal, ['TestClassTest'], hooks)
        .catch((error: unknown) => error)
      expect(caught).toBeInstanceOf(CompilationCheckFailedError)
      expect((caught as CompilationCheckFailedError).reason).toBe(reason)
      expect(hooks.onVerified).not.toHaveBeenCalled()
      expect(runner.getTestMethodsPerLines).not.toHaveBeenCalled()
    })

    it('Given the compile deploy rejects with a non-Error value, When prepare runs, Then the wrapped reason message is String(the thrown value)', async () => {
      // Arrange
      repository.update.mockRejectedValue('plain string compile failure')
      const { hooks } = recordingHooks()

      // Act & Assert
      const caught = await sut
        .prepare(mockOriginal, ['TestClassTest'], hooks)
        .catch((error: unknown) => error)
      expect(caught).toBeInstanceOf(CompilationCheckFailedError)
      expect((caught as CompilationCheckFailedError).reason.message).toBe(
        'plain string compile failure'
      )
    })
  })

  describe('evaluate', () => {
    it('Given the mutant deploy rejects with DeploymentFailedError, When evaluate runs, Then it resolves to a not-compilable verdict without running tests', async () => {
      // Arrange
      const { hooks } = recordingHooks()
      await sut.prepare(mockOriginal, ['TestClassTest'], hooks)
      const deployError = new DeploymentFailedError(
        'Deployment failed:\n[classes/Mutation.cls:10:9] Expression cannot be a statement.'
      )
      repository.update.mockRejectedValueOnce(deployError)

      // Act
      const result = await sut.evaluate('mutated body', new Set(['a.b']))

      // Assert
      expect(result).toEqual({
        kind: 'not-compilable',
        detail:
          'Deployment failed:\n[classes/Mutation.cls:10:9] Expression cannot be a statement.',
      })
      expect(runner.runTestMethods).not.toHaveBeenCalled()
    })

    it('Given the mutant deploy rejects with a PollTimeoutError, When evaluate runs, Then the error is rethrown by identity', async () => {
      // Arrange
      const { hooks } = recordingHooks()
      await sut.prepare(mockOriginal, ['TestClassTest'], hooks)
      const timeoutError = new PollTimeoutError('req-1', 'Queued')
      repository.update.mockRejectedValueOnce(timeoutError)

      // Act & Assert
      await expect(sut.evaluate('mutated body', new Set(['a.b']))).rejects.toBe(
        timeoutError
      )
    })

    it('Given the mutant deploy rejects with a plain Error, When evaluate runs, Then the error is rethrown by identity', async () => {
      // Arrange
      const { hooks } = recordingHooks()
      await sut.prepare(mockOriginal, ['TestClassTest'], hooks)
      const runtimeError = new Error('network down')
      repository.update.mockRejectedValueOnce(runtimeError)

      // Act & Assert
      await expect(sut.evaluate('mutated body', new Set(['a.b']))).rejects.toBe(
        runtimeError
      )
    })

    it('Given the test run rejects, When evaluate runs, Then the error is rethrown by identity and never classified as not-compilable', async () => {
      // Arrange — a DeploymentFailedError is used here even though the test
      // runner never really raises one: it is the one error type the catch
      // arm would misclassify as not-compilable if the try block widened to
      // cover the test run too, so it is what actually kills that mutant. A
      // plain Error would pass unchanged either way and prove nothing about
      // the try block's scope.
      const { hooks } = recordingHooks()
      await sut.prepare(mockOriginal, ['TestClassTest'], hooks)
      const testRunError = new DeploymentFailedError('Deployment failed:\nboom')
      runner.runTestMethods.mockRejectedValueOnce(testRunError)

      // Act
      const result = await sut
        .evaluate('mutated body', new Set(['a.b']))
        .catch((error: unknown) => error)

      // Assert
      expect(result).toBe(testRunError)
    })

    it('Given the mutant compiles and the tests run, When evaluate runs, Then it resolves to an executed verdict and deploys the mutated body under the original id', async () => {
      // Arrange
      const { hooks } = recordingHooks()
      await sut.prepare(mockOriginal, ['TestClassTest'], hooks)
      const testResult = { outcome: 'Failed', tests: [] }
      runner.runTestMethods.mockResolvedValueOnce(testResult)

      // Act
      const result = await sut.evaluate('mutated body', new Set(['a.b']))

      // Assert
      expect(result).toEqual({ kind: 'executed', result: testResult })
      expect(repository.update).toHaveBeenCalledWith({
        Id: mockOriginal.Id,
        Body: 'mutated body',
      })
    })
  })

  describe('restore', () => {
    it('Given prepare already ran, When restore is called with a policy, Then the original class is redeployed under that policy', async () => {
      // Arrange
      const { hooks } = recordingHooks()
      await sut.prepare(mockOriginal, ['TestClassTest'], hooks)
      repository.update.mockResolvedValueOnce({})

      // Act
      await sut.restore('run-tests')

      // Assert
      expect(repository.update).toHaveBeenCalledWith(mockOriginal, 'run-tests')
    })

    it('Given prepare has not run, When restore is called, Then it rejects rather than deploying', async () => {
      // Arrange & Act & Assert
      await expect(sut.restore('run-tests')).rejects.toThrow(
        'prepare() must run before evaluate() or restore()'
      )
      expect(repository.update).not.toHaveBeenCalled()
    })
  })
})
