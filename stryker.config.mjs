/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.mutation.ts',
  },
  mutate: ['src/mutator/**/*.ts', 'src/service/**/*.ts', 'src/type/**/*.ts'],
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
