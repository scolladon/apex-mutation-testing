import {
  type Baseline,
  CompilationCheckFailedError,
  type MutantVerdict,
  type MutationTestBed,
  type PrepareHooks,
  type RestorePolicy,
} from '../../port/mutationTestBed.js'
import {
  AggregateCoverageStrategy,
  PerTestCoverageStrategy,
} from '../../service/coverageStrategy.js'
import { timeExecution } from '../../service/timeUtils.js'
import type { ApexClass } from '../../type/ApexClass.js'
import type { TestMethodId } from '../../type/TestMethodId.js'
import {
  ApexClassRepository,
  DeploymentFailedError,
} from './apexClassRepository.js'
import { ApexSettingsRepository } from './apexSettingsRepository.js'
import { ApexTestRunner } from './apexTestRunner.js'

export class OrgMutationTestBed implements MutationTestBed {
  private original: ApexClass | undefined

  constructor(
    private readonly repository: ApexClassRepository,
    private readonly runner: ApexTestRunner,
    private readonly settings: ApexSettingsRepository,
    private readonly apexClassName: string
  ) {}

  public async prepare(
    original: ApexClass,
    perimeter: string[],
    hooks: PrepareHooks
  ): Promise<Baseline> {
    this.original = original
    hooks.onVerifying()
    let applyMs: number
    try {
      applyMs = (await timeExecution(() => this.repository.update(original)))
        .durationMs
    } catch (error: unknown) {
      throw new CompilationCheckFailedError(
        error instanceof Error ? error : new Error(String(error))
      )
    }
    hooks.onVerified()

    const strategy = (await this.settings.isAggregateCoverageOnly())
      ? new AggregateCoverageStrategy(this.apexClassName)
      : new PerTestCoverageStrategy(this.apexClassName)

    hooks.onBaselineStarting()
    const { result, durationMs: runMs } = await timeExecution(() =>
      this.runner.getTestMethodsPerLines(perimeter, strategy)
    )
    return { ...result, fidelity: strategy.fidelity, cost: { applyMs, runMs } }
  }

  public async evaluate(
    mutatedBody: string,
    tests: ReadonlySet<TestMethodId>
  ): Promise<MutantVerdict> {
    try {
      await this.repository.update({
        Id: this.requireOriginal().Id,
        Body: mutatedBody,
      })
    } catch (error: unknown) {
      // DeploymentFailedError — a compile error from the Tooling API deploy —
      // is matched by type rather than message text, because Salesforce
      // localises platform API error text to the org user's language: a
      // message match observed on an English-locale org would silently stop
      // matching on any other.
      if (error instanceof DeploymentFailedError) {
        return { kind: 'not-compilable', detail: error.message }
      }
      throw error
    }
    return { kind: 'executed', result: await this.runner.runTestMethods(tests) }
  }

  public async restore(policy: RestorePolicy): Promise<void> {
    await this.repository.update(this.requireOriginal(), policy)
  }

  private requireOriginal(): ApexClass {
    if (!this.original) {
      throw new Error(
        'OrgMutationTestBed: prepare() must run before evaluate() or restore()'
      )
    }
    return this.original
  }
}
