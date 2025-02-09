import { TestSession, execCmd } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { ApexMutationTestResult } from '../../../../../src/commands/apex/mutation/test/run.js';

let testSession: TestSession;

describe('hello world NUTs', () => {
  before('prepare session', async () => {
    testSession = await TestSession.create();
  });

  after(async () => {
    await testSession?.clean();
  });

  it('should say hello to the world', () => {
    const result = execCmd<ApexMutationTestResult>('hello world --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    expect(result?.name).to.equal('World');
  });

  it('should say hello to a given person', () => {
    const result = execCmd<ApexMutationTestResult>('hello world --name Astro --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    expect(result?.name).to.equal('Astro');
  });
});
