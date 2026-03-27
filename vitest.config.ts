import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [{ find: /^(.+)\.js$/, replacement: '$1' }],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/test/**/*.test.ts'],
    exclude: ['**/test/utils/**', '**/node_modules/**'],
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
      include: ['src/**/*.ts'],
      exclude: ['test/utils/**', 'reports/**'],
    },
  },
})
