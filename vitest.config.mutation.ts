import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [{ find: /^(.+)\.js$/, replacement: '$1' }],
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup/mutation-setup.ts'],
    include: ['**/test/unit/**/*.test.ts', '**/test/integration/**/*.test.ts'],
    clearMocks: true,
  },
})
