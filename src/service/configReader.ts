import { readFile } from 'node:fs/promises'

import * as RE2 from 're2'

import { ApexMutationParameter } from '../type/ApexMutationParameter.js'

const DEFAULT_CONFIG_FILE = '.mutation-testing.json'

interface MutationTestingConfig {
  mutators?: {
    include?: string[]
    exclude?: string[]
  }
  testMethods?: {
    include?: string[]
    exclude?: string[]
  }
  threshold?: number
  skipPatterns?: string[]
  lines?: string[]
}

export class ConfigReader {
  public async resolve(
    parameter: ApexMutationParameter
  ): Promise<ApexMutationParameter> {
    const configPath = parameter.configFile ?? DEFAULT_CONFIG_FILE
    const fileConfig = await this.readConfigFile(configPath)

    const resolved: ApexMutationParameter = {
      ...parameter,
      includeMutators:
        parameter.includeMutators ?? fileConfig?.mutators?.include,
      excludeMutators:
        parameter.excludeMutators ?? fileConfig?.mutators?.exclude,
      includeTestMethods:
        parameter.includeTestMethods ?? fileConfig?.testMethods?.include,
      excludeTestMethods:
        parameter.excludeTestMethods ?? fileConfig?.testMethods?.exclude,
      threshold: parameter.threshold ?? fileConfig?.threshold,
      skipPatterns: parameter.skipPatterns ?? fileConfig?.skipPatterns,
      lines: parameter.lines ?? fileConfig?.lines,
    }

    this.validate(resolved)

    return resolved
  }

  private async readConfigFile(
    configPath: string
  ): Promise<MutationTestingConfig | undefined> {
    try {
      const content = await readFile(configPath, 'utf-8')
      return JSON.parse(content) as MutationTestingConfig
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return undefined
      }
      throw new Error(
        `Failed to parse config file '${configPath}': ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private validate(parameter: ApexMutationParameter): void {
    if (parameter.includeMutators && parameter.excludeMutators) {
      throw new Error('Cannot specify both includeMutators and excludeMutators')
    }
    if (parameter.includeTestMethods && parameter.excludeTestMethods) {
      throw new Error(
        'Cannot specify both includeTestMethods and excludeTestMethods'
      )
    }
    if (
      parameter.threshold !== undefined &&
      (parameter.threshold < 0 || parameter.threshold > 100)
    ) {
      throw new Error('Threshold must be between 0 and 100')
    }
    if (parameter.skipPatterns) {
      for (const pattern of parameter.skipPatterns) {
        try {
          new RE2(pattern)
        } catch (error: unknown) {
          throw new Error(
            `Invalid skip pattern '${pattern}': ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }
    }
    if (parameter.lines) {
      for (const range of parameter.lines) {
        if (!/^\d+(-\d+)?$/.test(range)) {
          throw new Error(
            `Invalid line range '${range}': must be a number or range (e.g., '10' or '1-10')`
          )
        }
        if (range.includes('-')) {
          const [start, end] = range.split('-').map(Number)
          if (start > end) {
            throw new Error(
              `Invalid line range '${range}': start must be less than or equal to end`
            )
          }
        }
      }
    }
  }
}
