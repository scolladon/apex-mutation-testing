import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { ApexTestSuiteRepository } from '../../../../adapter/apexTestSuiteRepository.js'
import { ApexMutationHTMLReporter } from '../../../../reporter/HTMLReporter.js'
import {
  ApexClassNotFoundError,
  ApexClassValidator,
} from '../../../../service/apexClassValidator.js'
import { ConfigReader } from '../../../../service/configReader.js'
import { MutationTestingService } from '../../../../service/mutationTestingService.js'
import { formatSkippedTestClasses } from '../../../../service/skippedTestClassMessage.js'
import { TestSuiteResolver } from '../../../../service/testSuiteResolver.js'
import { ApexMutationParameter } from '../../../../type/ApexMutationParameter.js'
import {
  attachSuiteProvenance,
  reducePerimeter,
} from '../../../../type/SkippedTestClass.js'

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
      multiple: true,
      delimiter: ',',
      atLeastOne: ['test-class', 'test-suite'],
    }),
    'test-suite': Flags.string({
      summary: messages.getMessage('flags.test-suite.summary'),
      multiple: true,
      delimiter: ',',
      atLeastOne: ['test-class', 'test-suite'],
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
    'mutation-grouping': Flags.boolean({
      summary: messages.getMessage('flags.mutation-grouping.summary'),
    }),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  }

  public async run(): Promise<ApexMutationTestResult> {
    const { flags } = await this.parse(ApexMutationTest)
    const connection = flags['target-org'].getConnection(flags['api-version'])

    const parameters: ApexMutationParameter = {
      apexClassName: flags['apex-class'],
      apexTestClassNames: flags['test-class'] ?? [],
      apexTestSuiteNames: flags['test-suite'],
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
      mutationGrouping: flags['mutation-grouping'],
    }

    const configReader = new ConfigReader(messages)
    const configuredParameters = await configReader.resolve(parameters)

    const testSuiteResolver = new TestSuiteResolver(
      new ApexTestSuiteRepository(connection),
      messages
    )
    const resolvedParameters =
      await testSuiteResolver.resolve(configuredParameters)

    this.log(
      messages.getMessage(
        flags['dry-run']
          ? 'info.DryRunCommandIsRunning'
          : 'info.CommandIsRunning',
        [
          resolvedParameters.apexClassName,
          resolvedParameters.apexTestClassNames.join(', '),
        ]
      )
    )

    const apexClassValidator = new ApexClassValidator(connection)
    const [, skipped] = await Promise.all([
      apexClassValidator.validate(resolvedParameters),
      apexClassValidator.assessPerimeter(resolvedParameters.apexTestClassNames),
    ]).catch((error: unknown): never => {
      if (error instanceof ApexClassNotFoundError) {
        throw messages.createError('error.apexClassNotFound', [error.className])
      }
      throw error
    })

    const droppedTestClasses = attachSuiteProvenance(
      skipped,
      resolvedParameters.testClassOrigins
    )
    const sentences = formatSkippedTestClasses(droppedTestClasses, messages)
    for (const sentence of sentences) {
      this.warn(sentence)
    }

    const usableTestClassNames = reducePerimeter(
      resolvedParameters.apexTestClassNames,
      droppedTestClasses
    )
    if (usableTestClassNames.length === 0) {
      throw messages.createError('error.noUsableTestClass', [
        resolvedParameters.apexClassName,
        sentences.join('\n'),
      ])
    }

    const mutationTestingService = new MutationTestingService(
      this.progress,
      this.spinner,
      connection,
      { ...resolvedParameters, apexTestClassNames: usableTestClassNames },
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
