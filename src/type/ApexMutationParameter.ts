export interface ApexMutationParameter {
  apexClassName: string
  apexTestClassName: string
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
}
