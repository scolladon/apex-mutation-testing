import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { createOrgFlowEngine } from '../../../../adapter/org/orgEngine.js'
import { FlowMutationOrchestrator } from '../../../../flow/FlowMutationOrchestrator.js'
import type { FlowMutationResult } from '../../../../flow/types.js'
import {
  FlowAmbiguousError,
  FlowApiVersionTooLowError,
  FlowDeployFailedError,
  FlowDraftBesideActiveError,
  FlowNotFoundError,
  FlowRevertError,
  FlowTestNotFoundError,
  FlowTestPinError,
  FlowTestRepinFailedError,
  FlowTestVersionError,
  FlowVersionGuardError,
  FlowVersionLimitError,
  type FlowVersionState,
  NoFlowTestsError,
  ProductionOrgError,
  UnsupportedFlowVersionStateError,
} from '../../../../port/flowErrors.js'
import { FlowHTMLReporter } from '../../../../reporter/FlowHTMLReporter.js'
import {
  renderOrgDetail,
  reportEngineNotice,
} from '../../../../service/engineNotice.js'
import {
  calculateMutationScore,
  FLOW_SCORE_POLICY,
} from '../../../../service/mutationScore.js'
import { sanitizeForDisplay } from '../../../../service/skippedTestClassMessage.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.flow.run'
)

export type FlowMutationRunResult = {
  score: number | null
}

const FLOW_API_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/
const FLOW_TEST_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.]*$/

// "1, 2, 5 (5 Active)" — the numbers and the Active one, as the guard saw
// them.
const describeVersions = ({ numbers, active }: FlowVersionState): string =>
  `${numbers.join(', ') || '-'} (${
    active === undefined
      ? messages.getMessage('info.noActiveVersion')
      : messages.getMessage('info.activeVersion', [String(active)])
  })`

// Every typed rejection of the Flow engine renders as the command's own
// error; anything else is rethrown untouched. Names and versions travel on
// the error's fields; the org-supplied ones are sanitized before display.
function renderFlowError(error: unknown): never {
  if (error instanceof ProductionOrgError) {
    throw messages.createError('error.productionOrg')
  }
  if (error instanceof FlowApiVersionTooLowError) {
    throw messages.createError('error.apiVersionTooLow', [
      error.minimumApiVersion,
      error.apiVersion,
      error.minimumApiVersion,
    ])
  }
  if (error instanceof FlowNotFoundError) {
    throw messages.createError('error.flowNotFound', [error.apiName])
  }
  if (error instanceof FlowAmbiguousError) {
    throw messages.createError('error.flowAmbiguous', [
      error.apiName,
      String(error.count),
    ])
  }
  if (error instanceof NoFlowTestsError) {
    throw messages.createError('error.noFlowTests', [error.apiName])
  }
  if (error instanceof FlowTestNotFoundError) {
    throw messages.createError('error.flowTestNotFound', [
      error.apiName,
      error.testNames.map(sanitizeForDisplay).join(', '),
    ])
  }
  if (error instanceof UnsupportedFlowVersionStateError) {
    throw messages.createError('error.unsupportedFlowVersionState', [
      error.apiName,
      sanitizeForDisplay(error.status),
    ])
  }
  if (error instanceof FlowDraftBesideActiveError) {
    throw messages.createError('error.flowDraftBesideActive', [
      error.apiName,
      String(error.draftVersion),
      String(error.activeVersion),
    ])
  }
  if (error instanceof FlowVersionLimitError) {
    throw messages.createError('error.flowVersionLimit', [
      error.apiName,
      String(error.versionCount),
      String(error.versionLimit),
    ])
  }
  if (error instanceof FlowVersionGuardError) {
    throw messages.createError('error.flowVersionGuard', [
      error.apiName,
      describeVersions(error.expected),
      describeVersions(error.observed),
    ])
  }
  if (error instanceof FlowTestPinError) {
    throw messages.createError('error.flowTestPin', [
      sanitizeForDisplay(error.testName),
    ])
  }
  if (error instanceof FlowTestVersionError) {
    throw messages.createError('error.flowTestVersion', [
      error.apiName,
      String(error.expectedVersion),
      error.executedVersions.join(', ') ||
        messages.getMessage('info.noFlowTestResult'),
    ])
  }
  if (error instanceof FlowRevertError) {
    throw messages.createError('error.flowRevert', [
      error.apiName,
      renderOrgDetail(error.problems.join('; ')),
    ])
  }
  if (error instanceof FlowTestRepinFailedError) {
    throw messages.createError('error.flowTestRepinFailed', [
      renderOrgDetail(error.problems.join('; ')),
    ])
  }
  throw error
}

export default class FlowMutationRun extends SfCommand<FlowMutationRunResult> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')
  // Beta until an E2E run on sample flows backs it in CI: SfCommand then
  // warns on every run that the command may still change.
  public static override readonly state = 'beta'

  public static override readonly flags = {
    flow: Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.flow.summary'),
      required: true,
    }),
    'flow-test': Flags.string({
      char: 't',
      summary: messages.getMessage('flags.flow-test.summary'),
      multiple: true,
      delimiter: ',',
    }),
    'report-dir': Flags.directory({
      char: 'r',
      summary: messages.getMessage('flags.report-dir.summary'),
      exists: true,
      default: 'mutations',
    }),
    'dry-run': Flags.boolean({
      char: 'd',
      summary: messages.getMessage('flags.dry-run.summary'),
      default: false,
    }),
    lines: Flags.string({
      char: 'l',
      summary: messages.getMessage('flags.lines.summary'),
      multiple: true,
    }),
    threshold: Flags.integer({
      summary: messages.getMessage('flags.threshold.summary'),
      min: 0,
      max: 100,
    }),
    'allow-non-sandbox-org': Flags.boolean({
      summary: messages.getMessage('flags.allow-non-sandbox-org.summary'),
      default: false,
    }),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  }

  public async run(): Promise<FlowMutationRunResult> {
    const { flags } = await this.parse(FlowMutationRun)
    const flowApiName = flags.flow.trim()
    const flowTestNames = flags['flow-test']?.map(name => name.trim())
    this.assertNames(flowApiName, flowTestNames)

    const engine = await createOrgFlowEngine(
      {
        connection: flags['target-org'].getConnection(flags['api-version']),
        notify: notice => reportEngineNotice(notice, this.spinner, messages),
      },
      { allowNonSandbox: flags['allow-non-sandbox-org'] }
    ).catch(renderFlowError)

    this.log(
      messages.getMessage(
        flags['dry-run']
          ? 'info.DryRunCommandIsRunning'
          : 'info.CommandIsRunning',
        [
          flowApiName,
          flowTestNames?.join(', ') ?? messages.getMessage('info.allFlowTests'),
        ]
      )
    )
    const result = await new FlowMutationOrchestrator(
      this.progress,
      this.spinner,
      engine,
      messages
    )
      .run({
        flowApiName,
        flowTestNames,
        lines: flags.lines,
        dryRun: flags['dry-run'],
      })
      .catch(error =>
        renderFlowError(this.withDeployContext(error, flowApiName))
      )

    await this.publishReport(result, flags['report-dir'])

    const score = flags['dry-run']
      ? null
      : calculateMutationScore(
          result.mutants.map(mutant => mutant.status),
          FLOW_SCORE_POLICY
        )
    if (score !== null) {
      this.log(messages.getMessage('info.CommandSuccess', [score]))
    }
    this.enforceThreshold(score, flags.threshold)

    this.info(messages.getMessage('info.EncourageSponsorship'))
    return { score }
  }

  private assertNames(flowApiName: string, flowTestNames?: string[]): void {
    if (!FLOW_API_NAME_PATTERN.test(flowApiName)) {
      throw messages.createError('error.invalidFlowName', [flowApiName])
    }
    for (const name of flowTestNames ?? []) {
      if (!FLOW_TEST_NAME_PATTERN.test(name)) {
        throw messages.createError('error.invalidFlowTestName', [name])
      }
    }
  }

  // The one deploy failure that can escape the run unclassified is the
  // baseline's — a mutant's is a verdict — so it is the one rendered here.
  private withDeployContext(error: unknown, flowApiName: string): unknown {
    return error instanceof FlowDeployFailedError
      ? messages.createError('error.flowDeployFailed', [
          flowApiName,
          renderOrgDetail(error.problems.join('; ')),
        ])
      : error
  }

  private async publishReport(
    result: FlowMutationResult,
    reportDir: string
  ): Promise<void> {
    await new FlowHTMLReporter(messages).generateReport(result, reportDir)
    this.log(messages.getMessage('info.reportGenerated', [reportDir]))
  }

  private enforceThreshold(
    score: number | null,
    threshold: number | undefined
  ): void {
    if (score === null || threshold === undefined) return
    if (score < threshold) {
      throw messages.createError('error.thresholdNotMet', [
        String(score),
        String(threshold),
      ])
    }
  }
}
