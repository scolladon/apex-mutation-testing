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
  reporters: ['html', 'clear-text', 'progress'],
  coverageAnalysis: 'perTest',
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },
  concurrency: 2,
  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },
}
