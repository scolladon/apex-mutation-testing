import { TestClassOrigins } from './TestClassOrigin.js'

export interface ApexMutationParameter {
  apexClassName: string
  apexTestClassNames: string[]
  apexTestSuiteNames?: string[]
  reportDir: string
  dryRun?: boolean
  includeMutators?: string[]
  excludeMutators?: string[]
  includeTestMethods?: string[]
  excludeTestMethods?: string[]
  threshold?: number
  configFile?: string
  skipPatterns?: string[]
  lines?: string[]
  mutationGrouping?: boolean
  testClassOrigins?: TestClassOrigins
}
