/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.mutation.ts',
  },
  // Adapter and reporter layers historically escaped mutation testing; the
  // code review found real bugs there (MetadataContainer leak, HTML escaping
  // gap, infinite poll), so include them in the mutate scope.
  mutate: [
    'src/adapter/**/*.ts',
    'src/mutator/**/*.ts',
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
