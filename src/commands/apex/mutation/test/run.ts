import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { ApexMutationHTMLReporter } from '../../../../reporter/HTMLReporter.js'
import { MutationTestingService } from '../../../../service/mutationTestingService.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.test.run'
)

export type ApexMutationTestResult = {
  score: number
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
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  }

  public async run(): Promise<ApexMutationTestResult> {
    // parse the provided flags
    const { flags } = await this.parse(ApexMutationTest)
    const connection = flags['target-org'].getConnection(flags['api-version'])

    this.log(
      messages.getMessage('info.CommandIsRunning', [
        flags['apex-class'],
        flags['test-class'],
      ])
    )

    const mutationTestingService = new MutationTestingService(
      this.progress,
      this.spinner,
      connection,
      {
        apexClassName: flags['apex-class'],
        apexClassTestName: flags['test-class'],
      }
    )
    const mutationResult = await mutationTestingService.process()

    const htmlReporter = new ApexMutationHTMLReporter()
    await htmlReporter.generateReport(mutationResult, flags['report-dir'])
    this.log(messages.getMessage('info.reportGenerated', [flags['report-dir']]))

    const score = mutationTestingService.calculateScore(mutationResult)

    this.log(messages.getMessage('info.CommandSuccess', [score]))

    this.info(messages.getMessage('info.EncourageSponsorship'))
    return {
      score,
    }
  }
}
