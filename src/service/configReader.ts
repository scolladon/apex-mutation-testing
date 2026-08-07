import { readFile } from 'node:fs/promises'

import { Messages } from '@salesforce/core'
import { ApexMutationParameter } from '../type/ApexMutationParameter.js'
import { compileSkipPattern, type SkipPattern } from './skipPattern.js'

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
  mutationGrouping?: boolean
}

export class ConfigReader {
  constructor(private readonly messages: Messages<string>) {}

  public async resolve(
    parameter: ApexMutationParameter
  ): Promise<ApexMutationParameter> {
    const configPath = parameter.configFile ?? DEFAULT_CONFIG_FILE
    const fileConfig = await this.readConfigFile(configPath)

    const resolved: ApexMutationParameter = {
      ...parameter,
      apexTestClassNames: ConfigReader.normalizeClassPerimeter(
        parameter.apexTestClassNames,
        this.messages
      ),
      apexTestSuiteNames: ConfigReader.normalizeSuiteNames(
        parameter.apexTestSuiteNames,
        this.messages
      ),
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
      mutationGrouping:
        parameter.mutationGrouping ?? fileConfig?.mutationGrouping,
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

  public static parseLineRanges(
    lines: string[] | undefined
  ): Set<number> | undefined {
    if (!lines || lines.length === 0) {
      return undefined
    }
    const result = new Set<number>()
    for (const range of lines) {
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(Number)
        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
          throw new Error(
            `Invalid line range '${range}': must be a number or range (e.g., '10' or '1-10')`
          )
        }
        for (let i = start; i <= end; i++) {
          result.add(i)
        }
      } else {
        const value = Number(range)
        if (!Number.isFinite(value)) {
          throw new Error(
            `Invalid line range '${range}': must be a number or range (e.g., '10' or '1-10')`
          )
        }
        result.add(value)
      }
    }
    return result
  }

  public static compileSkipPatterns(
    patterns: string[] | undefined
  ): SkipPattern[] {
    if (!patterns) {
      return []
    }
    return patterns.map(pattern => {
      try {
        return compileSkipPattern(pattern)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Invalid skip pattern '${pattern}': ${message}`)
      }
    })
  }

  // Trims each element, rejects a blank one, dedupes by a caller-supplied
  // key while keeping the first-seen spelling, and preserves user order.
  private static normalizeNames(
    names: string[],
    keyOf: (name: string) => string,
    messages: Messages<string>,
    blankMessageKey: string
  ): string[] {
    const seenByKey = new Map<string, string>()
    for (const raw of names) {
      const trimmed = raw.trim()
      if (trimmed === '') {
        throw new Error(messages.getMessage(blankMessageKey, [raw]))
      }
      const key = keyOf(trimmed)
      if (!seenByKey.has(key)) {
        seenByKey.set(key, trimmed)
      }
    }
    return [...seenByKey.values()]
  }

  // Downstream code (validator, service, executor) may assume a
  // non-empty, trimmed, duplicate-free perimeter.
  public static normalizeClassPerimeter(
    names: string[],
    messages: Messages<string>
  ): string[] {
    return ConfigReader.normalizeNames(
      names,
      // Case-fold direction is arbitrary: `key` is a write-only lookup
      // token — `values()` above returns `trimmed`, never `key` — so
      // lower- or upper-casing it yields identical de-dup grouping for
      // any input.
      name => name.toLowerCase(),
      messages,
      'error.blankTestClass'
    )
  }

  // The org matches ApexTestSuite.TestSuiteName case-sensitively (a
  // case-mismatched equality or LIKE filter returns zero rows) while it
  // matches ApexClass.Name case-insensitively. Folding suite names the
  // same way as class names would silently drop a genuinely different
  // suite and mask a wrong-case lookup, so the two rules must diverge.
  public static normalizeSuiteNames(
    names: string[] | undefined,
    messages: Messages<string>
  ): string[] {
    return ConfigReader.normalizeNames(
      names ?? [],
      name => name,
      messages,
      'error.blankTestSuite'
    )
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
