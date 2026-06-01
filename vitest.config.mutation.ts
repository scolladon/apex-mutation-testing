import { defineSuite } from './vitest.config.base'

export default defineSuite({
  test: {
    setupFiles: ['./test/setup/mutation-setup.ts'],
    include: ['**/test/unit/**/*.test.ts', '**/test/integration/**/*.test.ts'],
  },
})
