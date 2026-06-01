import { defineConfig, mergeConfig } from 'vitest/config'

const baseConfig = defineConfig({
  resolve: {
    alias: [{ find: /^(.+)\.js$/, replacement: '$1' }],
  },
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
  },
})

type SuiteConfig = Parameters<typeof mergeConfig>[1]

export const defineSuite = (config: SuiteConfig) =>
  mergeConfig(baseConfig, config)
