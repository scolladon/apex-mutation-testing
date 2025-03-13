import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { ApexMutationHTMLReporter } from '../../../../reporter/HTMLReporter.js'
import { ApexClassValidator } from '../../../../service/apexClassValidator.js'
import { MutationTestingService } from '../../../../service/mutationTestingService.js'
import { ApexMutationParameter } from '../../../../type/ApexMutationParameter.js'

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
      exists: false,
      default: 'mutations',
    }),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  }

  public async run(): Promise<ApexMutationTestResult> {
    // parse the provided flags
    const { flags } = await this.parse(ApexMutationTest)
    const connection = flags['target-org'].getConnection(flags['api-version'])

    const parameters: ApexMutationParameter = {
      apexClassName: flags['apex-class'],
      apexTestClassName: flags['test-class'],
      reportDir: flags['report-dir'],
    }

    if (!existsSync(parameters.reportDir)) {
      try {
        await mkdir(parameters.reportDir, { recursive: true })
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        throw new Error(`Unable to create report directory: ${errorMessage}`)
      }
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
      parameters
    )
    const mutationResult = await mutationTestingService.process()

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
