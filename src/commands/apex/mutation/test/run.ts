import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { ApexMutationHTMLReporter } from '../../../../reporter/HTMLReporter.js'
import { ApexClassValidator } from '../../../../service/apexClassValidator.js'
import { ConfigReader } from '../../../../service/configReader.js'
import { MutationTestingService } from '../../../../service/mutationTestingService.js'
import { ApexMutationParameter } from '../../../../type/ApexMutationParameter.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.test.run'
)

export type ApexMutationTestResult = {
  score: number | null
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
    'include-test-methods': Flags.string({
      summary: messages.getMessage('flags.include-test-methods.summary'),
      exclusive: ['exclude-test-methods'],
      multiple: true,
    }),
    'exclude-test-methods': Flags.string({
      summary: messages.getMessage('flags.exclude-test-methods.summary'),
      exclusive: ['include-test-methods'],
      multiple: true,
    }),
    threshold: Flags.integer({
      summary: messages.getMessage('flags.threshold.summary'),
      min: 0,
      max: 100,
    }),
    'skip-patterns': Flags.string({
      char: 's',
      summary: messages.getMessage('flags.skip-patterns.summary'),
      multiple: true,
    }),
    lines: Flags.string({
      char: 'l',
      summary: messages.getMessage('flags.lines.summary'),
      multiple: true,
    }),
    'config-file': Flags.file({
      summary: messages.getMessage('flags.config-file.summary'),
      exists: true,
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
      includeMutators: flags['include-mutators'],
      excludeMutators: flags['exclude-mutators'],
      includeTestMethods: flags['include-test-methods'],
      excludeTestMethods: flags['exclude-test-methods'],
      threshold: flags['threshold'],
      skipPatterns: flags['skip-patterns'],
      lines: flags['lines'],
      configFile: flags['config-file'],
    }

    const configReader = new ConfigReader()
    const resolvedParameters = await configReader.resolve(parameters)

    this.log(
      messages.getMessage(
        flags['dry-run']
          ? 'info.DryRunCommandIsRunning'
          : 'info.CommandIsRunning',
        [resolvedParameters.apexClassName, resolvedParameters.apexTestClassName]
      )
    )

    const apexClassValidator = new ApexClassValidator(connection)
    await apexClassValidator.validate(resolvedParameters)

    const mutationTestingService = new MutationTestingService(
      this.progress,
      this.spinner,
      connection,
      resolvedParameters,
      messages
    )
    const mutationResult = await mutationTestingService.process()

    const htmlReporter = new ApexMutationHTMLReporter()
    await htmlReporter.generateReport(
      mutationResult,
      resolvedParameters.reportDir
    )
    this.log(
      messages.getMessage('info.reportGenerated', [
        resolvedParameters.reportDir,
      ])
    )

    const score = flags['dry-run']
      ? null
      : mutationTestingService.calculateScore(mutationResult)

    if (score !== null) {
      this.log(messages.getMessage('info.CommandSuccess', [score]))
    }

    if (score !== null && resolvedParameters.threshold !== undefined) {
      if (score < resolvedParameters.threshold) {
        throw messages.createError('error.thresholdNotMet', [
          String(score),
          String(resolvedParameters.threshold),
        ])
      }
    }

    this.info(messages.getMessage('info.EncourageSponsorship'))
    return { score }
  }
}
