import { defineSuite } from './vitest.config.base'

export default defineSuite({
  test: {
    include: ['**/test/unit/**/*.test.ts', '**/test/integration/**/*.test.ts'],
  },
})
