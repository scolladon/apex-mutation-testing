import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { MutationTestingService } from '../../../../service/mutationTestingService.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.test.run'
)

export type ApexMutationTestResult = {
  'zombies-count': number
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

    const mutationTestingService = new MutationTestingService(connection, {
      apexClassName: flags['apex-class'],
      apexClassTestName: flags['test-class'],
    })

    const zombiesCount = await mutationTestingService.process()

    return {
      'zombies-count': zombiesCount,
    }
  }
}
