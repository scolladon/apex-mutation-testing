export default {
  entry: [
    'src/commands/apex/mutation/test/run.ts',
    'bin/dev.js',
    '**/*.{nut,test}.ts',
    'test/perf/**/*.{ts,mjs}',
    'vitest.config.perf.ts',
    '.github/**/*.yml',
    'vitest.config.mutation.ts',
  ],
  project: ['**/*.{ts,js,json,yml}'],
  ignoreDependencies: [
    '@commitlint/config-conventional',
    '@stryker-mutator/api',
    // Resolved via createRequire + readFile in src/reporter/HTMLReporter.ts;
    // knip cannot see the runtime file read.
    'mutation-testing-elements',
    // Invoked via `npm exec -- pkg-pr-new publish …` in .github/workflows/npm-service.yml;
    // knip's npm resolver only follows `npm exec --` into its own known binaries/plugins,
    // not arbitrary package names, so it never sees this one.
    'pkg-pr-new',
  ],
  ignoreBinaries: ['commitlint', 'npm-check-updates', 'sf'],
  ignoreUnresolved: ['test/e2e'],
}
