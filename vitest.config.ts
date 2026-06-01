import { defineSuite } from './vitest.config.base'

export default defineSuite({
  test: {
    include: ['**/test/**/*.test.ts'],
    exclude: ['**/test/utils/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov'],
      reportsDirectory: 'reports/coverage',
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
      include: ['src/**/*.ts'],
      exclude: ['test/utils/**', 'reports/**'],
    },
  },
})
