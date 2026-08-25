import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { createOrgEngine } from '../../../../adapter/org/orgEngine.js'
import {
  ApexClassAmbiguousError,
  ApexClassNotFoundError,
  ApexClassNotMutableError,
  ApexClassUnqualifiedError,
} from '../../../../port/apexClassErrors.js'
import type { ApexSourceProvider } from '../../../../port/apexSourceProvider.js'
import type { EngineBundle } from '../../../../port/executionEngine.js'
import { ApexMutationHTMLReporter } from '../../../../reporter/HTMLReporter.js'
import { ApexClassValidator } from '../../../../service/apexClassValidator.js'
import { ConfigReader } from '../../../../service/configReader.js'
import { reportEngineNotice } from '../../../../service/engineNotice.js'
import { MutationTestingService } from '../../../../service/mutationTestingService.js'
import {
  formatSkippedTestClasses,
  sanitizeForDisplay,
} from '../../../../service/skippedTestClassMessage.js'
import { TestSuiteResolver } from '../../../../service/testSuiteResolver.js'
import { ApexMutationParameter } from '../../../../type/ApexMutationParameter.js'
import type { ApexMutationTestResult as MutationProcessResult } from '../../../../type/ApexMutationTestResult.js'
import {
  attachSuiteProvenance,
  reducePerimeter,
} from '../../../../type/SkippedTestClass.js'
import type { TestClassResolutions } from '../../../../type/TestClassResolution.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.test.run'
)

export type ApexMutationTestResult = {
  score: number | null
}

// Every rejection from validate/assessPerimeter passes through here.
// ApexClassNotFoundError renders as the command's own error; anything else
// is rethrown untouched — no rejection reason is swallowed. className is
// user-typed and pinned to the identifier grammar before any org call, so it
// needs no sanitizing; states and spellings embed org-supplied
// ManageableState/NamespacePrefix values, unconstrained by any grammar on
// the aer local backend, so each is sanitized the same way
// skippedTestClassMessage.ts sanitizes org-supplied text.
function renderTargetClassError(error: unknown): never {
  if (error instanceof ApexClassNotFoundError) {
    throw messages.createError('error.apexClassNotFound', [error.className])
  }
  if (error instanceof ApexClassNotMutableError) {
    throw messages.createError('error.apexClassNotMutable', [
      error.className,
      error.states.map(sanitizeForDisplay).join(', '),
    ])
  }
  if (error instanceof ApexClassAmbiguousError) {
    throw messages.createError('error.apexClassAmbiguous', [
      error.className,
      error.spellings.map(sanitizeForDisplay).join(', '),
    ])
  }
  if (error instanceof ApexClassUnqualifiedError) {
    throw messages.createError('error.apexClassUnqualified', [
      error.className,
      sanitizeForDisplay(error.spelling),
    ])
  }
  throw error
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

    const engine = await createOrgEngine({
      connection,
      notify: notice => reportEngineNotice(notice, this.spinner, messages),
    })

    return this.mutate(engine, flags)
  }

  private async mutate(
    engine: EngineBundle,
    flags: Awaited<ReturnType<ApexMutationTest['parse']>>['flags']
  ): Promise<ApexMutationTestResult> {
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

    const resolvedParameters = await this.resolveParameters(
      parameters,
      engine.source
    )
    this.logRunningLine(resolvedParameters)

    const { usable, resolutions } = await this.reduceToUsablePerimeter(
      resolvedParameters,
      engine.source
    )

    const mutationTestingService = new MutationTestingService(
      this.progress,
      this.spinner,
      engine,
      {
        ...resolvedParameters,
        apexTestClassNames: usable,
        testClassResolutions: resolutions,
      },
      messages
    )
    const mutationResult = await mutationTestingService.process()

    await this.publishReport(mutationResult, resolvedParameters.reportDir)

    const score = resolvedParameters.dryRun
      ? null
      : mutationTestingService.calculateScore(mutationResult)

    if (score !== null) {
      this.log(messages.getMessage('info.CommandSuccess', [score]))
    }
    this.enforceThreshold(score, resolvedParameters.threshold)

    this.info(messages.getMessage('info.EncourageSponsorship'))
    return { score }
  }

  private async resolveParameters(
    parameters: ApexMutationParameter,
    source: ApexSourceProvider
  ): Promise<ApexMutationParameter> {
    const configReader = new ConfigReader(messages)
    const configuredParameters = await configReader.resolve(parameters)

    const testSuiteResolver = new TestSuiteResolver(source, messages)
    return testSuiteResolver.resolve(configuredParameters)
  }

  private logRunningLine(parameters: ApexMutationParameter): void {
    this.log(
      messages.getMessage(
        parameters.dryRun
          ? 'info.DryRunCommandIsRunning'
          : 'info.CommandIsRunning',
        [parameters.apexClassName, parameters.apexTestClassNames.join(', ')]
      )
    )
  }

  private async reduceToUsablePerimeter(
    parameters: ApexMutationParameter,
    source: ApexSourceProvider
  ): Promise<{ usable: string[]; resolutions: TestClassResolutions }> {
    const apexClassValidator = new ApexClassValidator(source)
    const [, perimeterAssessment] = await Promise.all([
      apexClassValidator.validate(parameters),
      apexClassValidator.assessPerimeter(parameters.apexTestClassNames),
    ]).catch(renderTargetClassError)

    const { skipped: verdicts, resolutions } = perimeterAssessment
    const skipped = attachSuiteProvenance(verdicts, parameters.testClassOrigins)
    const sentences = formatSkippedTestClasses(skipped, messages)
    sentences.forEach(sentence => this.warn(sentence))

    const usable = reducePerimeter(parameters.apexTestClassNames, skipped)
    if (usable.length === 0) {
      throw messages.createError('error.noUsableTestClass', [
        parameters.apexClassName,
        sentences.join('\n'),
      ])
    }
    return {
      usable,
      resolutions: new Map(resolutions.map(r => [r.classId, r])),
    }
  }

  private async publishReport(
    mutationResult: MutationProcessResult,
    reportDir: string
  ): Promise<void> {
    const htmlReporter = new ApexMutationHTMLReporter(messages)
    await htmlReporter.generateReport(mutationResult, reportDir)
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
