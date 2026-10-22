import * as fs from 'node:fs/promises'
import { Messages, SfError } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { FlowSalesforceAdapter } from '../../../../flow/adapters/FlowSalesforceAdapter.js'
import { FlowMutationOrchestrator } from '../../../../flow/FlowMutationOrchestrator.js'
import { FlowResolver } from '../../../../flow/FlowResolver.js'
import { FlowHTMLReporter } from '../../../../flow/reporter/FlowHTMLReporter.js'
import type {
  FlowMutationReport,
  FlowOrchestratorCallbacks,
  FlowSalesforcePort,
} from '../../../../flow/types.js'
import { formatDuration } from '../../../../service/timeUtils.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.flow.run'
)

export type FlowMutationRunResult = {
  score: number | null
  report: FlowMutationReport
}

export default class FlowMutationRun extends SfCommand<FlowMutationRunResult> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')

  public static override readonly flags = {
    flow: Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.flow.summary'),
      aliases: ['flow-file'],
      required: true,
    }),
    'flow-name': Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.flow-name.summary'),
    }),
    'flow-tests': Flags.string({
      char: 't',
      summary: messages.getMessage('flags.flow-tests.summary'),
      aliases: ['test-flow', 'flow-test'],
      multiple: true,
      delimiter: ',',
    }),
    'test-apex': Flags.string({
      summary: messages.getMessage('flags.test-apex.summary'),
      aliases: ['ta', 'test-class'],
      multiple: true,
      delimiter: ',',
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
    'report-dir': Flags.directory({
      char: 'r',
      summary: messages.getMessage('flags.report-dir.summary'),
      default: 'mutations',
    }),
    'target-org': Flags.optionalOrg(),
    'api-version': Flags.orgApiVersion(),
  }

  protected override async init(): Promise<void> {
    const hasFlow = this.argv.some(
      a =>
        a === '-f' ||
        a.startsWith('-f=') ||
        a === '--flow' ||
        a.startsWith('--flow=') ||
        a === '--flow-file' ||
        a.startsWith('--flow-file=')
    )
    this.argv = this.argv.map(arg => {
      if (arg === '-ta') return '--test-apex'
      if (arg.startsWith('-ta=')) return '--test-apex=' + arg.slice(4)
      if (!hasFlow) {
        if (arg === '-n') return '-f'
        if (arg.startsWith('-n=')) return '-f=' + arg.slice(3)
        if (arg === '--flow-name') return '--flow'
        if (arg.startsWith('--flow-name=')) return '--flow=' + arg.slice(12)
      }
      return arg
    })
    await super.init()
  }

  public async run(): Promise<FlowMutationRunResult> {
    const { flags } = await this.parse(FlowMutationRun)

    if (!flags['dry-run'] && !flags['target-org']) {
      throw new SfError(
        'Flag --target-org is required when not running with --dry-run.'
      )
    }

    const adapter = flags['target-org']
      ? new FlowSalesforceAdapter(
          flags['target-org'].getConnection(flags['api-version'])
        )
      : ({} as FlowSalesforcePort)

    const resolved = await FlowResolver.resolve(
      flags.flow,
      flags['target-org'] ? adapter : undefined
    )
    const flowFilePath = resolved.flowFilePath
    const flowDeveloperName = flags['flow-name'] ?? resolved.flowDeveloperName
    const tempDir = resolved.tempDir

    try {
      const orchestrator = new FlowMutationOrchestrator(adapter)

      const isApexTesting = Boolean(
        flags['test-apex'] && flags['test-apex'].length > 0
      )
      const testsDisplay = isApexTesting
        ? flags['test-apex']!.join(', ')
        : flags['flow-tests']?.join(', ') || flowDeveloperName

      this.log(
        messages.getMessage(
          flags['dry-run']
            ? 'info.DryRunCommandIsRunning'
            : isApexTesting
              ? 'info.ApexTestCommandIsRunning'
              : 'info.CommandIsRunning',
          flags['dry-run']
            ? [flowDeveloperName]
            : [flowDeveloperName, testsDisplay]
        )
      )

      const callbacks: FlowOrchestratorCallbacks = {
        onValidating: () => {
          this.spinner.start(`Validating "${flowDeveloperName}" Flow XML`)
        },
        onValidated: () => {
          this.spinner.stop('Done')
        },
        onBaselineDeploying: () => {
          this.spinner.start(
            `Verifying "${flowDeveloperName}" baseline Flow deployment`
          )
        },
        onBaselineDeployed: () => {
          this.spinner.stop('Done')
        },
        onBaselineTesting: () => {
          this.spinner.start(
            `Executing "${testsDisplay}" ${isApexTesting ? 'Apex' : 'Flow'} test(s) to verify baseline`
          )
        },
        onBaselineTested: (resultMsg: string) => {
          this.spinner.stop(resultMsg)
        },
        onMutantsGenerating: () => {
          this.spinner.start(
            `Generating mutants for "${flowDeveloperName}" Flow`
          )
        },
        onMutantsGenerated: (count: number) => {
          this.spinner.stop(`${count} mutations generated`)
        },
        onTimeEstimate: (
          deployTime: number,
          testTime: number,
          mutationCount: number,
          groupCount: number
        ) => {
          const totalEstimateMs = (deployTime + testTime) * groupCount
          this.spinner.start(
            messages.getMessage('info.timeEstimate', [
              formatDuration(totalEstimateMs),
            ]),
            undefined,
            { stdout: true }
          )
          this.spinner.stop(
            messages.getMessage('info.timeEstimateBreakdown', [
              formatDuration(deployTime),
              formatDuration(testTime),
              String(mutationCount),
              String(groupCount),
            ])
          )
        },
        onProgressStart: (total: number) => {
          this.progress.start(
            total,
            { info: 'Starting mutation testing' },
            {
              title: 'MUTATION TESTING PROGRESS',
              format: '%s | {bar} | {value}/{total} {info}',
            }
          )
        },
        onProgressUpdate: (current: number, info: string) => {
          this.progress.update(current, { info })
        },
        onProgressFinish: (info: string) => {
          this.progress.finish({ info })
        },
        onRollbackStarting: () => {
          this.spinner.start(
            `Rolling back "${flowDeveloperName}" Flow to its original state`
          )
        },
        onRollbackFinished: (failed?: boolean) => {
          this.spinner.stop(failed ? 'Rollback FAILED' : 'Done')
        },
      }

      const report = await orchestrator.run({
        flowFilePath,
        flowDeveloperName,
        flowTests: flags['flow-tests'],
        apexTests: flags['test-apex'],
        lines: flags.lines,
        dryRun: flags['dry-run'],
        callbacks,
      })

      const reporter = new FlowHTMLReporter()
      const reportDir = await reporter.generateReport(
        report,
        flags['report-dir'] ?? 'mutations'
      )
      this.log(messages.getMessage('info.reportGenerated', [reportDir]))

      const score = flags['dry-run'] ? null : report.mutationScore
      if (score !== null) {
        this.log(`Mutation score: ${score}%`)
      }
      this.info(
        '🤩 Enjoying apex-mutation-testing?\nYour contribution helps us provide fast support 🚀 and high quality features 🔥\nBecome a sponsor: https://github.com/sponsors/scolladon 🧡'
      )

      if (
        !flags['dry-run'] &&
        flags.threshold !== undefined &&
        report.mutationScore < flags.threshold
      ) {
        throw new SfError(
          `Mutation score ${report.mutationScore}% is below threshold ${flags.threshold}%.`
        )
      }

      return {
        score,
        report,
      }
    } finally {
      if (tempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true })
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }
}
