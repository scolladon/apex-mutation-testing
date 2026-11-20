// The command's module-level declarations — its message bundle
// registration, its summaries, its examples — run once, when the module is
// imported. A test file that imports the command statically simply fails to
// load when one of them breaks, and no test reports a failure; importing the
// command inside the test turns that break into a failing test. Nothing here
// registers the messages directory: the command has to do it itself.
describe('apex mutation flow run module', () => {
  it('Given the command module, When imported, Then it registers its own bundle and every declaration comes from it', async () => {
    // Act
    const command = (
      await import('../../../../../../src/commands/apex/mutation/flow/run.js')
    ).default
    const { Messages } = await import('@salesforce/core')
    const bundle = Messages.loadMessages(
      'apex-mutation-testing',
      'apex.mutation.flow.run'
    )

    // Assert
    expect(command.summary).toBe(bundle.getMessage('summary'))
    expect(command.description).toBe(bundle.getMessage('description'))
    expect(command.examples).toEqual(bundle.getMessages('examples'))
    const declared = command.flags as unknown as Record<
      string,
      { summary?: string }
    >
    for (const name of [
      'flow',
      'flow-test',
      'report-dir',
      'dry-run',
      'include-mutators',
      'exclude-mutators',
      'lines',
      'threshold',
      'config-file',
    ]) {
      expect(declared[name].summary).toBe(
        bundle.getMessage(`flags.${name}.summary`)
      )
    }
    // importing the command loads the whole plugin: allow for a busy machine
  }, 30_000)
})
