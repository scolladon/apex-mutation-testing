import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { ApexMutationHTMLReporter } from '../../../../reporter/HTMLReporter.js'
import { ApexClassValidator } from '../../../../service/apexClassValidator.js'
import { MutationTestingService } from '../../../../service/mutationTestingService.js'
import { ApexMutationParameter } from '../../../../type/ApexMutationParameter.js'
import { ApexMutationTestResult as MutationTestResult } from '../../../../type/ApexMutationTestResult.js'
import { DryRunMutant } from '../../../../type/DryRunMutant.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.test.run'
)

export type ApexMutationTestResult =
  | {
      score: number
    }
  | {
      mutants: DryRunMutant[]
    }

export default class ApexMutationTest extends SfCommand<ApexMutationTestResult> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')

  public static override readonly flags = {
    'apex-class': Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.apex-class.summary'),
      required: true,
    }),
    'test-class': Flags.string({
      char: 't',
      summary: messages.getMessage('flags.test-class.summary'),
      required: true,
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
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  }

  public async run(): Promise<ApexMutationTestResult> {
    const { flags } = await this.parse(ApexMutationTest)
    const connection = flags['target-org'].getConnection(flags['api-version'])

    const parameters: ApexMutationParameter = {
      apexClassName: flags['apex-class'],
      apexTestClassName: flags['test-class'],
      reportDir: flags['report-dir'],
      dryRun: flags['dry-run'],
    }

    this.log(
      messages.getMessage('info.CommandIsRunning', [
        parameters.apexClassName,
        parameters.apexTestClassName,
      ])
    )

    const apexClassValidator = new ApexClassValidator(connection)
    await apexClassValidator.validate(parameters)

    const mutationTestingService = new MutationTestingService(
      this.progress,
      this.spinner,
      connection,
      parameters,
      messages
    )
    const result = await mutationTestingService.process()

    if (flags['dry-run']) {
      const mutants = result as DryRunMutant[]

      this.table({
        data: mutants.map(m => ({ ...m })),
        columns: ['line', 'mutatorName', 'original', 'replacement'],
        title: 'Dry Run: Mutation Preview',
        overflow: 'wrap',
      })

      const countByMutator = new Map<string, number>()
      for (const mutant of mutants) {
        countByMutator.set(
          mutant.mutatorName,
          (countByMutator.get(mutant.mutatorName) ?? 0) + 1
        )
      }
      for (const [name, count] of [...countByMutator.entries()].sort(
        (a, b) => b[1] - a[1]
      )) {
        this.log(
          messages.getMessage('info.dryRunSummary', [name, String(count)])
        )
      }

      const lineCount = new Set(mutants.map(m => m.line)).size
      this.log(
        messages.getMessage('info.dryRunTotal', [
          String(mutants.length),
          String(lineCount),
        ])
      )

      this.info(messages.getMessage('info.EncourageSponsorship'))
      return { mutants }
    }

    const mutationResult = result as MutationTestResult
    const htmlReporter = new ApexMutationHTMLReporter()
    await htmlReporter.generateReport(mutationResult, parameters.reportDir)
    this.log(
      messages.getMessage('info.reportGenerated', [parameters.reportDir])
    )

    const score = mutationTestingService.calculateScore(mutationResult)

    this.log(messages.getMessage('info.CommandSuccess', [score]))

    this.info(messages.getMessage('info.EncourageSponsorship'))
    return {
      score,
    }
  }
}
