import { readFile } from 'node:fs/promises';
import { TestItem, TestLevel, TestResult, TestService } from '@salesforce/apex-node';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { MutantGenerator } from '../../../../mutantGenerator.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('apex-mutation-testing', 'apex.mutation.test.run');

export type ApexMutationTestResult = {
  'mutants-number': number;
  'report-dir': string;
};

export default class ApexMutationTest extends SfCommand<ApexMutationTestResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'class-file': Flags.file({
      char: 'c',
      summary: messages.getMessage('flags.class-file.summary'),
      exists: true,
      required: true,
    }),
    'test-class': Flags.string({
      char: 't',
      summary: messages.getMessage('flags.test-file.summary'),
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
  };

  public async run(): Promise<ApexMutationTestResult> {
    // parse the provided flags
    const { flags } = await this.parse(ApexMutationTest);

    // Read class-file
    const classInitialContent = await readFile(flags['class-file'], 'utf8');

    // Compute every mutant
    const connection = flags['target-org'].getConnection(flags['api-version']);
    const testService = new TestService(connection);
    const mutantGenerator = new MutantGenerator();
    const mutations = mutantGenerator.compute(classInitialContent);
    for (const mutation of mutations) {
      const mutatedVersion = mutantGenerator.getMutatedVersion(mutation);
      // deploy the code and run the test-file
      const deployResult = await connection.tooling.sobject('ApexClass').update({
        Id: mutation.classId, // Assuming mutation object contains classId
        Body: mutatedVersion,
      });

      if (!deployResult.success) {
        //this.error(`Failed to deploy mutation: ${mutation.id}`);
        continue;
      }

      const testConfig: {
        tests: [{ classNames: flags['test-class'] }];
        testLevel: TestLevel.RunSpecifiedTests;
        skipCodeCoverage: true;
        maxFailedTests: 0;
      };

      const testResult = await testService.runTestSynchronous(testConfig);

      // Compute the test result and store the surviving mutants
    }

    // Rollback the deployment

    // Generate Stryker-style mutation report

    return {
      'mutants-number': 10,
      'report-dir': flags['report-dir'],
    };
  }
}
