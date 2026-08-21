import { readFile } from 'node:fs/promises'

import { Messages } from '@salesforce/core'
import { ApexMutationParameter } from '../type/ApexMutationParameter.js'
import { compileSkipPattern, type SkipPattern } from './skipPattern.js'

const DEFAULT_CONFIG_FILE = '.mutation-testing.json'

// An Apex class name is a letter followed by letters, digits or
// underscores, optionally preceded by one namespace qualifier and a dot
// (e.g. 'MyClass' or 'MyNamespace.MyClass'). Enforcing that shape keeps
// every other character out of the Tooling API query text: its
// string-literal builder escapes quotes but leaves backslashes raw, so a
// name carrying a backslash escapes the closing quote and the literal runs
// on into the rest of the WHERE clause. The added segment admits exactly
// one '.' between two identifier segments, so no quote, backslash or
// whitespace becomes representable — the injection guard is intact.
const APEX_CLASS_NAME_PATTERN =
  /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)?$/

// `ns__Class` passes the grammar above but is uncompilable as an Apex
// class name (the Apex compiler rejects a double underscore in an
// identifier), so it can only ever be the object-field/object-record
// convention typed by mistake for the dotted class convention.
const OBJECT_CONVENTION_SEPARATOR = '__'

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
    // The class under mutation reaches the same lookup as the perimeter, so
    // it answers to the same rule — checked first, before any file or org I/O.
    ConfigReader.assertClassName(parameter.apexClassName, this.messages)

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
    const normalized = ConfigReader.normalizeNames(
      names,
      // Case-fold direction is arbitrary: `key` is a write-only lookup
      // token — `values()` above returns `trimmed`, never `key`. This
      // holds because Apex class identifiers are ASCII-only (letters,
      // digits, underscore): the characters where lower- and upper-
      // casing diverge (e.g. 'ß', the Kelvin sign U+212A) cannot occur
      // in a real class name, so no reachable input can expose a
      // difference in de-dup grouping between the two directions. A
      // qualified spelling ('mockery.Foo') folds to a different key than
      // its bare counterpart ('foo') on purpose — they are distinct
      // classes and must not collapse into one dedup entry.
      // Stryker disable next-line MethodExpression: see the note above — no
      // reachable class name distinguishes lower- from upper-casing here.
      name => name.toLowerCase(),
      messages,
      'error.blankTestClass'
    )
    for (const name of normalized) {
      ConfigReader.assertClassName(name, messages)
    }
    return normalized
  }

  private static assertClassName(
    name: string,
    messages: Messages<string>
  ): void {
    if (!APEX_CLASS_NAME_PATTERN.test(name)) {
      throw new Error(messages.getMessage('error.invalidClassName', [name]))
    }
    if (name.includes(OBJECT_CONVENTION_SEPARATOR)) {
      throw new Error(
        messages.getMessage('error.objectConventionClassName', [name])
      )
    }
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
    // The `!== undefined` half is type narrowing only: `undefined < 0` and
    // `undefined > 100` are both false, so an unset threshold never throws.
    const { threshold } = parameter
    // Stryker disable next-line ConditionalExpression: type narrowing only.
    if (threshold !== undefined && (threshold < 0 || threshold > 100)) {
      throw new Error('Threshold must be between 0 and 100')
    }
    if (parameter.lines) {
      for (const range of parameter.lines) {
        if (!/^\d+(-\d+)?$/.test(range)) {
          throw new Error(
            `Invalid line range '${range}': must be a number or range (e.g., '10' or '1-10')`
          )
        }
        // Not observable: the regex above already accepted the range, and for a
        // bare number `split('-')` yields a single element so `end` is
        // undefined and `start > undefined` is false either way.
        // Stryker disable next-line ConditionalExpression,StringLiteral: no-op for bare numbers.
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
