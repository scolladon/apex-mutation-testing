import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

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
    'test-file': Flags.file({
      char: 't',
      summary: messages.getMessage('flags.test-file.summary'),
      exists: true,
      required: true,
    }),
    'report-dir': Flags.file({
      char: 'r',
      summary: messages.getMessage('flags.report-dir.summary'),
      exists: true,
      default: 'mutations',
    }),
    'target-org': Flags.requiredOrg(),
  };

  public async run(): Promise<ApexMutationTestResult> {
    // parse the provided flags
    const { flags } = await this.parse(ApexMutationTest);

    // Get the orgId from the Org instance stored in the `target-org` flag
    //const orgId = flags['target-org'].getOrgId()
    // Get the connection from the Org instance stored in the `target-org` flag
    //const connection = flags['target-org'].getConnection()

    const mutantNumbers = 10;

    return {
      'mutants-number': mutantNumbers,
      'report-dir': flags['report-dir'],
    };
  }
}
