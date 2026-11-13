import type { Messages } from '@salesforce/core'
import type { Progress, Spinner } from '@salesforce/sf-plugins-core'
import type { FlowEngineBundle } from '../port/executionEngine.js'
import { FlowOrgSafetyError } from '../port/flowErrors.js'
import type { FlowSource } from '../port/flowSourceProvider.js'
import type { FlowBaseline } from '../port/flowTestBed.js'
import { ConfigReader } from '../service/configReader.js'
import {
  type OutputSink,
  renderOrgDetail,
  writeToStdout,
} from '../service/engineNotice.js'
import { sanitizeForDisplay } from '../service/skippedTestClassMessage.js'
import { formatDuration, formatRemainingTime } from '../service/timeUtils.js'
import { FlowMutantGenerator } from './FlowMutantGenerator.js'
import { FlowValidator } from './FlowValidator.js'
import type { FlowMutant, FlowMutationResult } from './types.js'
import { applyEdits, type FlowXmlDom } from './xml/FlowXmlDom.js'

export interface FlowMutationParameters {
  flowApiName: string
  flowTestNames?: string[]
  lines?: string[]
  dryRun: boolean
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// Lifecycle: read the flow from the org → validate → generate → (dry run
// stops here) → prepare a baseline → evaluate each mutant → restore. The
// restore runs on every exit once prepare has started, because prepare is
// already the first write to the org.
export class FlowMutationOrchestrator {
  constructor(
    private readonly progress: Progress,
    private readonly spinner: Spinner,
    private readonly engine: FlowEngineBundle,
    private readonly messages: Messages<string>,
    private readonly validator: FlowValidator = new FlowValidator(),
    private readonly generator: FlowMutantGenerator = new FlowMutantGenerator(),
    private readonly outputSink: OutputSink = writeToStdout
  ) {}

  public async run(
    parameters: FlowMutationParameters
  ): Promise<FlowMutationResult> {
    ConfigReader.validateLineRanges(parameters.lines, this.messages)
    const allowedLines = ConfigReader.parseLineRanges(
      parameters.lines,
      this.messages
    )
    const source = await this.readFlow(parameters)
    const dom = this.validate(source)
    const mutants = this.generateMutants(parameters, dom, allowedLines)
    if (!parameters.dryRun) {
      await this.executeWithRestore(source, mutants)
    }
    return { flowApiName: source.apiName, sourceXml: source.xml, mutants }
  }

  private async readFlow(
    parameters: FlowMutationParameters
  ): Promise<FlowSource> {
    this.spinner.start(
      this.messages.getMessage('info.readingFlow', [parameters.flowApiName]),
      undefined,
      { stdout: true }
    )
    const source = await this.engine.source.readFlow(
      parameters.flowApiName,
      parameters.flowTestNames
    )
    this.spinner.stop(
      this.messages.getMessage('info.flowRead', [
        source.tests.map(test => test.fullName).join(', '),
      ])
    )
    return source
  }

  private validate(source: FlowSource): FlowXmlDom {
    const validation = this.validator.validate(source.xml)
    if (validation.isValid) {
      return validation.dom
    }
    const tokens =
      validation.reason === 'invalidXml'
        ? [source.apiName, validation.detail]
        : validation.reason === 'unsupportedProcessType'
          ? [source.apiName, validation.processType]
          : [source.apiName]
    throw new Error(
      this.messages.getMessage(`error.flowInvalid.${validation.reason}`, tokens)
    )
  }

  private generateMutants(
    parameters: FlowMutationParameters,
    dom: FlowXmlDom,
    allowedLines: Set<number> | undefined
  ): FlowMutant[] {
    this.spinner.start(
      this.messages.getMessage('info.generatingMutants', [
        parameters.flowApiName,
      ]),
      undefined,
      { stdout: true }
    )
    const mutants = this.generator.generate(dom, allowedLines)
    this.spinner.stop(
      this.messages.getMessage('info.mutantsGenerated', [
        String(mutants.length),
      ])
    )
    if (mutants.length === 0) {
      throw new Error(
        allowedLines
          ? this.messages.getMessage('error.noMutationsInLineRange', [
              parameters.flowApiName,
              // allowedLines is only ever parsed from lines
              (parameters.lines as string[]).join(', '),
            ])
          : this.messages.getMessage('error.noMutations', [
              parameters.flowApiName,
            ])
      )
    }
    return mutants
  }

  private async executeWithRestore(
    source: FlowSource,
    mutants: FlowMutant[]
  ): Promise<void> {
    try {
      const baseline = await this.prepareBaseline(source)
      this.displayTimeEstimate(baseline, mutants.length)
      await this.evaluateMutants(source, mutants)
    } catch (runError: unknown) {
      this.stopProgress()
      throw await this.restoreAfterFailure(source, runError)
    }
    await this.restore(source)
  }

  private async prepareBaseline(source: FlowSource): Promise<FlowBaseline> {
    const baseline = await this.engine.testBed.prepare(source, {
      onPreparing: () =>
        this.spinner.start(
          this.messages.getMessage('info.preparingFlowVersion', [
            source.apiName,
          ]),
          undefined,
          { stdout: true }
        ),
      onPrepared: () =>
        this.spinner.stop(this.messages.getMessage('info.done')),
      onBaselineStarting: () =>
        this.spinner.start(
          this.messages.getMessage('info.runningBaseline', [
            String(source.tests.length),
          ]),
          undefined,
          { stdout: true }
        ),
    })
    if (baseline.failingTests.length > 0) {
      this.spinner.stop(this.messages.getMessage('info.baselineFailed'))
      throw new Error(
        this.messages.getMessage('error.baselineTestsFailed', [
          source.apiName,
          baseline.failingTests.join(', '),
        ])
      )
    }
    this.spinner.stop(this.messages.getMessage('info.baselinePassed'))
    return baseline
  }

  private displayTimeEstimate(baseline: FlowBaseline, count: number): void {
    const { applyMs, runMs } = baseline.cost
    this.spinner.start(
      this.messages.getMessage('info.timeEstimate', [
        formatDuration((applyMs + runMs) * count),
      ]),
      undefined,
      { stdout: true }
    )
    this.spinner.stop(
      this.messages.getMessage('info.timeEstimateBreakdown', [
        formatDuration(applyMs),
        formatDuration(runMs),
        String(count),
      ])
    )
  }

  private async evaluateMutants(
    source: FlowSource,
    mutants: FlowMutant[]
  ): Promise<void> {
    this.progress.start(
      mutants.length,
      { info: this.messages.getMessage('info.progressStarting') },
      {
        title: 'MUTATION TESTING PROGRESS',
        format: '%s | {bar} | {value}/{total} {info}',
      }
    )
    const loopStart = performance.now()
    for (const [index, mutant] of mutants.entries()) {
      this.progress.update(index, {
        info: `${formatRemainingTime(loopStart, index, mutants.length)}${this.messages.getMessage('info.evaluatingMutant', [mutant.description])}`,
      })
      await this.evaluateMutant(source, mutant)
      this.progress.update(index + 1, {
        info: `${formatRemainingTime(loopStart, index + 1, mutants.length)}${this.messages.getMessage(`info.mutantResult.${mutant.status}`)}`,
      })
    }
    this.progress.finish({
      info: this.messages.getMessage('info.progressFinished'),
    })
  }

  // A transport failure on one mutant scores it RuntimeError and the run goes
  // on; a failed safety check on the org's own state is never a verdict about
  // a mutant — it aborts the run, and the restore follows.
  private async evaluateMutant(
    source: FlowSource,
    mutant: FlowMutant
  ): Promise<void> {
    try {
      const verdict = await this.engine.testBed.evaluate(
        applyEdits(source.xml, mutant.edits)
      )
      if (verdict.kind === 'not-compilable') {
        mutant.status = 'CompileError'
        mutant.statusReason = verdict.detail
      } else if (verdict.failingTests.length > 0) {
        mutant.status = 'Killed'
        mutant.killedBy = verdict.failingTests
      } else {
        mutant.status = 'Survived'
      }
    } catch (error: unknown) {
      if (error instanceof FlowOrgSafetyError) {
        throw error
      }
      mutant.status = 'RuntimeError'
      mutant.statusReason = errorMessage(error)
    }
  }

  // Reaching the restore is the whole point of the caller, so a renderer
  // teardown failure must not preempt it: it is reported, not propagated —
  // on stdout, apart from the bar's own stream, as the Apex service does.
  private stopProgress(): void {
    try {
      this.progress.stop()
    } catch (error: unknown) {
      this.outputSink(
        `${this.messages.getMessage('info.progressTeardownFailed', [
          sanitizeForDisplay(errorMessage(error)),
        ])}\n`
      )
    }
  }

  // Returns the error for the caller to throw. The run failure is the root
  // cause and leads the message; a restore failure is appended, so "the org
  // was not restored" is never lost behind it.
  private async restoreAfterFailure(
    source: FlowSource,
    runError: unknown
  ): Promise<unknown> {
    try {
      await this.restore(source)
      return runError
    } catch (restoreError: unknown) {
      return new Error(
        `${errorMessage(runError)}\n${errorMessage(restoreError)}`,
        {
          cause: runError,
        }
      )
    }
  }

  private async restore(source: FlowSource): Promise<void> {
    this.spinner.start(
      this.messages.getMessage('info.restoringFlow', [source.apiName]),
      undefined,
      { stdout: true }
    )
    try {
      await this.engine.testBed.restore()
      this.spinner.stop(this.messages.getMessage('info.done'))
    } catch (error: unknown) {
      this.spinner.stop(this.messages.getMessage('info.restoreFailed'))
      throw new Error(
        this.messages.getMessage('error.flowRestoreFailed', [
          source.apiName,
          renderOrgDetail(errorMessage(error)),
        ]),
        { cause: error }
      )
    }
  }
}
