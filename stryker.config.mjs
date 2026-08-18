/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.mutation.ts',
  },
  // Adapter and reporter layers historically escaped mutation testing; the
  // code review found real bugs there (MetadataContainer leak, HTML escaping
  // gap, infinite poll), so include them in the mutate scope.
  // This list is an explicit enumeration with no catch-all, so a new top-level
  // src/ directory silently escapes mutation testing until it is added here —
  // which is how the adapter and reporter layers came to be missing above.
  // Check this list whenever one is created. src/commands/ is the one directory
  // deliberately left out: it holds only the oclif command shell, whose wiring
  // the NUT suite covers end to end rather than by mutant.
  mutate: [
    'src/adapter/**/*.ts',
    'src/mutator/**/*.ts',
    'src/port/**/*.ts',
    'src/reporter/**/*.ts',
    'src/service/**/*.ts',
    'src/type/**/*.ts',
  ],
  reporters: ['html', 'clear-text', 'progress', 'json'],
  coverageAnalysis: 'perTest',
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },
  concurrency: 2,
  // Shared across the four sibling plugins: high 95 / low 90 / break 90.
  // Note the PR job mutates only the files changed against origin/main, so the
  // score it reports is scoped to that subset and is not comparable to a full
  // run. That job is advisory (continue-on-error), so break never blocks it.
  thresholds: {
    high: 95,
    low: 90,
    break: 90,
  },
}
