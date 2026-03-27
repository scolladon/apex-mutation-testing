import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [{ find: /^(.+)\.js$/, replacement: '$1' }],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/test/**/*.test.ts'],
    exclude: ['**/test/nut/**', '**/test/utils/**', '**/node_modules/**'],
    clearMocks: true,
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
      exclude: ['test/utils/**', 'reports/**'],
    },
  },
})
