import { defineSuite } from './vitest.config.base'

export default defineSuite({
  test: {
    include: ['**/test/nut/**/*.test.ts'],
  },
})
