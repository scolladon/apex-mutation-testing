import { readFile } from 'node:fs/promises'

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
  }
}
