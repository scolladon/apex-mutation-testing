import { Messages, SfError } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { createOrgFlowEngine } from '../../../../adapter/org/orgEngine.js'
import { FlowMutationOrchestrator } from '../../../../flow/FlowMutationOrchestrator.js'
import type { FlowMutationResult } from '../../../../flow/types.js'
import {
  FlowActiveVersionNotDeletedError,
  FlowAmbiguousError,
  FlowApiVersionTooLowError,
  FlowChangedOutsideRunError,
  FlowDeployFailedError,
  FlowDeployNotCompletedError,
  FlowDraftBesideActiveError,
  FlowForeignActiveVersionError,
  FlowLeftoverVersionError,
  FlowNamespacedOrgError,
  FlowNotFoundError,
  FlowRestoreError,
  FlowRevertError,
  FlowRunAndRestoreError,
  FlowRuntimeErrorStreakError,
  FlowTestChangedOutsideRunError,
  FlowTestLeftoverError,
  FlowTestNotFoundError,
  FlowTestPinError,
  FlowTestRepinFailedError,
  FlowTestRestorePinError,
  FlowTestsNotRunError,
  FlowTestVersionError,
  FlowVersionGuardError,
  FlowVersionLimitError,
  type FlowVersionState,
  NoFlowTestsError,
  ProductionOrgError,
  UnsupportedFlowVersionStateError,
} from '../../../../port/flowErrors.js'
import { FlowHTMLReporter } from '../../../../reporter/FlowHTMLReporter.js'
import { ConfigReader } from '../../../../service/configReader.js'
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
// A FlowTest name, optionally qualified (<flow>.<test>, FlowTesting.<flow>.
// <test>): dot-separated identifiers, none of them empty.
const FLOW_TEST_NAME_PATTERN =
  /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/

// "1, 2, 5 (5 Active)" — the numbers and the Active one, as the guard saw
// them.
const describeVersions = ({ numbers, active }: FlowVersionState): string =>
  `${numbers.join(', ') || '-'} (${
    active === undefined
      ? messages.getMessage('info.noActiveVersion')
      : messages.getMessage('info.activeVersion', [String(active)])
  })`

const versionList = (versions: number[]): string => versions.join(', ') || '-'

type Rendered = [key: string, tokens?: string[]]

// The bundle message every typed rejection of the Flow engine renders as.
// Names and versions travel on the error's fields; the org-supplied ones are
// sanitized before display. Undefined for anything else.
const renderedOf = (
  error: unknown,
  flowApiName: string
): Rendered | undefined => {
  if (error instanceof ProductionOrgError) return ['error.productionOrg']
  if (error instanceof FlowNamespacedOrgError) {
    return ['error.namespacedOrg', [sanitizeForDisplay(error.namespacePrefix)]]
  }
  if (error instanceof FlowApiVersionTooLowError) {
    return [
      'error.apiVersionTooLow',
      [error.minimumApiVersion, error.apiVersion, error.minimumApiVersion],
    ]
  }
  if (error instanceof FlowNotFoundError) {
    return ['error.flowNotFound', [error.apiName]]
  }
  if (error instanceof FlowAmbiguousError) {
    return ['error.flowAmbiguous', [error.apiName, String(error.count)]]
  }
  if (error instanceof NoFlowTestsError) {
    return ['error.noFlowTests', [error.apiName]]
  }
  if (error instanceof FlowTestNotFoundError) {
    return [
      'error.flowTestNotFound',
      [error.apiName, error.testNames.map(sanitizeForDisplay).join(', ')],
    ]
  }
  if (error instanceof UnsupportedFlowVersionStateError) {
    return [
      'error.unsupportedFlowVersionState',
      [error.apiName, sanitizeForDisplay(error.status)],
    ]
  }
  if (error instanceof FlowDraftBesideActiveError) {
    return [
      'error.flowDraftBesideActive',
      [error.apiName, String(error.draftVersion), String(error.activeVersion)],
    ]
  }
  if (error instanceof FlowLeftoverVersionError) {
    return [
      'error.flowLeftoverVersion',
      [error.apiName, versionList(error.versionNumbers)],
    ]
  }
  if (error instanceof FlowTestLeftoverError) {
    return [
      'error.flowTestLeftover',
      [
        sanitizeForDisplay(error.testName),
        error.apiName,
        versionList(error.pinnedVersions),
      ],
    ]
  }
  if (error instanceof FlowChangedOutsideRunError) {
    return [
      error.beforeAnyWrite
        ? 'error.flowChangedBeforeRun'
        : 'error.flowChangedOutsideRun',
      [error.apiName, versionList(error.changedVersions)],
    ]
  }
  if (error instanceof FlowTestChangedOutsideRunError) {
    return [
      error.beforeAnyWrite
        ? 'error.flowTestChangedBeforeRun'
        : 'error.flowTestChangedOutsideRun',
      [error.testNames.map(sanitizeForDisplay).join(', ')],
    ]
  }
  if (error instanceof FlowVersionLimitError) {
    return [
      'error.flowVersionLimit',
      [error.apiName, String(error.versionCount), String(error.versionLimit)],
    ]
  }
  if (error instanceof FlowVersionGuardError) {
    return [
      'error.flowVersionGuard',
      [
        error.apiName,
        describeVersions(error.expected),
        describeVersions(error.observed),
      ],
    ]
  }
  if (error instanceof FlowTestPinError) {
    return ['error.flowTestPin', [sanitizeForDisplay(error.testName)]]
  }
  if (error instanceof FlowTestRestorePinError) {
    return [
      'error.flowTestRestorePin',
      [
        sanitizeForDisplay(error.testName),
        versionList(error.expectedVersions),
        versionList(error.foundVersions),
      ],
    ]
  }
  if (error instanceof FlowTestsNotRunError) {
    return [
      'error.flowTestsNotRun',
      [error.apiName, error.missingTests.map(sanitizeForDisplay).join(', ')],
    ]
  }
  if (error instanceof FlowTestVersionError) {
    return [
      'error.flowTestVersion',
      [
        error.apiName,
        String(error.expectedVersion),
        error.executedVersions.join(', ') ||
          messages.getMessage('info.noFlowTestResult'),
      ],
    ]
  }
  if (error instanceof FlowDeployNotCompletedError) {
    return [
      'error.flowDeployNotCompleted',
      [
        sanitizeForDisplay(error.asyncProcessId ?? '-'),
        sanitizeForDisplay(error.status),
        renderOrgDetail(error.detail),
      ],
    ]
  }
  if (error instanceof FlowForeignActiveVersionError) {
    return [
      'error.flowForeignActiveVersion',
      [
        error.apiName,
        error.activeVersion === undefined
          ? messages.getMessage('info.noActiveVersion')
          : messages.getMessage('info.activeVersion', [
              String(error.activeVersion),
            ]),
        String(error.originalVersion),
      ],
    ]
  }
  if (error instanceof FlowActiveVersionNotDeletedError) {
    return ['error.flowActiveVersionNotDeleted', [String(error.versionNumber)]]
  }
  if (error instanceof FlowRevertError) {
    return [
      'error.flowRevert',
      [error.apiName, textsOf(error.failures, flowApiName)],
    ]
  }
  if (error instanceof FlowRestoreError) {
    return [
      'error.flowRestoreFailed',
      [error.apiName, textsOf(error.failures, flowApiName)],
    ]
  }
  if (error instanceof FlowTestRepinFailedError) {
    return [
      'error.flowTestRepinFailed',
      [renderOrgDetail(error.problems.join('; '))],
    ]
  }
  // The one deploy failure that escapes the run unclassified is the
  // baseline's — a mutant's is a verdict.
  if (error instanceof FlowDeployFailedError) {
    return [
      'error.flowDeployFailed',
      [flowApiName, renderOrgDetail(error.problems.join('; '))],
    ]
  }
  if (error instanceof FlowRuntimeErrorStreakError) {
    return [
      'error.runtimeErrorStreak',
      [String(error.count), error.apiName, renderOrgDetail(error.lastReason)],
    ]
  }
  return undefined
}

// The text a failure reads as: its bundle message when it is a typed one,
// else its own message as the org gave it, sanitized and bounded.
const textOf = (error: unknown, flowApiName: string): string => {
  if (error instanceof FlowRunAndRestoreError) {
    return `${textOf(error.runError, flowApiName)}\n${textOf(error.restoreError, flowApiName)}`
  }
  const rendered = renderedOf(error, flowApiName)
  if (rendered) return messages.getMessage(...rendered)
  return renderOrgDetail(error instanceof Error ? error.message : String(error))
}

const textsOf = (failures: Error[], flowApiName: string): string =>
  failures.map(failure => textOf(failure, flowApiName)).join('; ')

// Renders a failure of the run as the command's own error, both parts of a
// run failure followed by a failed restore included; anything untyped is
// rethrown untouched.
function renderFlowError(error: unknown, flowApiName: string): never {
  if (error instanceof FlowRunAndRestoreError) {
    throw new SfError(
      textOf(error, flowApiName),
      error.name,
      undefined,
      undefined,
      error
    )
  }
  const rendered = renderedOf(error, flowApiName)
  if (rendered) throw messages.createError(...rendered)
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
    'include-mutators': Flags.string({
      summary: messages.getMessage('flags.include-mutators.summary'),
      exclusive: ['exclude-mutators'],
      multiple: true,
    }),
    'exclude-mutators': Flags.string({
      summary: messages.getMessage('flags.exclude-mutators.summary'),
      exclusive: ['include-mutators'],
      multiple: true,
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
    'config-file': Flags.file({
      summary: messages.getMessage('flags.config-file.summary'),
      exists: true,
    }),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  }

  public async run(): Promise<FlowMutationRunResult> {
    const { flags } = await this.parse(FlowMutationRun)
    const flowApiName = flags.flow.trim()
    const flowTestNames = flags['flow-test']?.map(name => name.trim())
    this.assertNames(flowApiName, flowTestNames)
    const config = await new ConfigReader(messages).resolveFlow({
      configFile: flags['config-file'],
      includeMutators: flags['include-mutators'],
      excludeMutators: flags['exclude-mutators'],
      threshold: flags.threshold,
    })

    const engine = await createOrgFlowEngine({
      connection: flags['target-org'].getConnection(flags['api-version']),
      notify: notice => reportEngineNotice(notice, this.spinner, messages),
    }).catch(error => renderFlowError(error, flowApiName))

    this.log(this.runningMessage(flags['dry-run'], flowApiName, flowTestNames))
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
        includeMutators: config.includeMutators,
        excludeMutators: config.excludeMutators,
        dryRun: flags['dry-run'],
      })
      .catch(error => renderFlowError(error, flowApiName))

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
    this.enforceThreshold(score, config.threshold)

    this.info(messages.getMessage('info.EncourageSponsorship'))
    return { score }
  }

  private runningMessage(
    dryRun: boolean,
    flowApiName: string,
    flowTestNames: string[] | undefined
  ): string {
    const prefix = dryRun
      ? 'info.DryRunCommandIsRunning'
      : 'info.CommandIsRunning'
    return flowTestNames
      ? messages.getMessage(prefix, [flowApiName, flowTestNames.join(', ')])
      : messages.getMessage(`${prefix}AllTests`, [flowApiName])
  }

  private assertNames(flowApiName: string, flowTestNames?: string[]): void {
    if (!FLOW_API_NAME_PATTERN.test(flowApiName)) {
      throw messages.createError('error.invalidFlowName', [flowApiName])
    }
    for (const name of flowTestNames ?? []) {
      if (name === '') {
        throw messages.createError('error.blankFlowTest')
      }
      if (!FLOW_TEST_NAME_PATTERN.test(name)) {
        throw messages.createError('error.invalidFlowTestName', [name])
      }
    }
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
    if (score === null) return
    // Stryker disable next-line ConditionalExpression: type narrowing only —
    // `score < undefined` is false, so an unset threshold never throws.
    if (threshold === undefined) return
    if (score < threshold) {
      throw messages.createError('error.thresholdNotMet', [
        String(score),
        String(threshold),
      ])
    }
  }
}
