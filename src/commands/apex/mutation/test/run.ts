import {
  //TestItem,
  TestLevel,
  //TestResult,
  TestService,
} from '@salesforce/apex-node'
import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { MutantGenerator } from '../../../../mutantGenerator.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.test.run'
)

export type ApexMutationTestResult = {
  'mutants-number': number
  'report-dir': string
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

    // Read class-file
    const classDefinition = (
      await connection.tooling
        .sobject('ApexClass')
        .find({ Name: flags['apex-class'] })
        .execute()
    )[0]

    // TODO if class does not exist

    try {
      // Compute every mutant
      const testService = new TestService(connection)
      const mutantGenerator = new MutantGenerator()
      const mutations = mutantGenerator.compute(classDefinition['Body'])
      for (const mutation of mutations) {
        const mutatedVersion = mutantGenerator.getMutatedVersion(mutation)
        console.log(mutatedVersion)
        // deploy the code and run the test-file
        const deployResult = await connection.tooling
          .sobject('ApexClass')
          .update({
            Id: classDefinition.Id as string,
            Body: mutatedVersion,
          })

        if (!deployResult.success) {
          //this.error(`Failed to deploy mutation: ${mutation.id}`);
          continue
        }

        const testResult = await testService.runTestSynchronous({
          tests: [{ className: flags['test-class'] }],
          testLevel: TestLevel.RunSpecifiedTests,
          skipCodeCoverage: true,
          maxFailedTests: 0,
        })

        console.log(testResult)

        // Compute the test result and store the surviving mutants
      }

      // Rollback the deployment

      // Generate Stryker-style mutation report
    } catch (error) {
      console.log(error)
      throw error
    }

    return {
      'mutants-number': 10,
      'report-dir': flags['report-dir'],
    }
  }
}
