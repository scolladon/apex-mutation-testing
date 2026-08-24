import { readFile } from 'node:fs/promises'

import { Messages } from '@salesforce/core'
import { z } from 'zod'
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
//
// A second downstream SOQL sink this grammar also guards against:
// @salesforce/apex-node's testService.js builds
// `... WHERE Name = '${shortName}' ...` with zero escaping, in the helper
// reached only through getApexClassIds / buildSuite. This plugin never
// calls that path — it only calls runTestSynchronous / runTestAsynchronous
// — so there is no live exposure today, but a future widening of this
// grammar must be evaluated against both sinks, not just jsforce's
// quote-only escaping.
const APEX_CLASS_NAME_PATTERN =
  /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)?$/

// `ns__Class` passes the grammar above but is uncompilable as an Apex
// class name (the Apex compiler rejects a double underscore in an
// identifier), so it can only ever be the object-field/object-record
// convention typed by mistake for the dotted class convention.
const OBJECT_CONVENTION_SEPARATOR = '__'

const nameListSchema = z
  .object({
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  })
  .optional()

// The schema is the single source of truth for the config file's shape: the
// type below is inferred from it, so a field cannot be added to one and
// forgotten in the other. Unknown keys are stripped rather than rejected,
// which keeps a config written for a newer plugin version readable by an
// older one.
const configSchema = z.object({
  mutators: nameListSchema,
  testMethods: nameListSchema,
  threshold: z.number().optional(),
  skipPatterns: z.array(z.string()).optional(),
  lines: z.array(z.string()).optional(),
  mutationGrouping: z.boolean().optional(),
})

type MutationTestingConfig = z.infer<typeof configSchema>

// zod reports `expected` but not the value it found, so the offending value is
// read back out of the input by walking the issue path.
const valueAtPath = (
  root: unknown,
  path: ReadonlyArray<PropertyKey>
): unknown =>
  path.reduce<unknown>(
    (value, key) => (value as Record<PropertyKey, unknown> | undefined)?.[key],
    root
  )

const MESSAGE_KEY_BY_EXPECTED: Record<string, string> = {
  number: 'error.configFieldNotNumber',
  boolean: 'error.configFieldNotBoolean',
  string: 'error.configEntryNotString',
}

const CONFIG_ARRAY_MESSAGE_KEY = 'error.configFieldNotStringArray'

// Names the shape the user actually wrote, so the message can contrast it with
// the expected one. `typeof []` is 'object', which tells the reader nothing.
const describeType = (value: unknown): string =>
  Array.isArray(value) ? 'an array' : typeof value

export class ConfigReader {
  constructor(private readonly messages: Messages<string>) {}

  public async resolve(
    parameter: ApexMutationParameter
  ): Promise<ApexMutationParameter> {
    // The class under mutation reaches the same lookup as the perimeter, so
    // it answers to the same rule — checked first, before any file or org I/O.
    ConfigReader.assertClassName(parameter.apexClassName, this.messages)

    const configPath = parameter.configFile ?? DEFAULT_CONFIG_FILE
    const rawConfig = await this.readConfigFile(configPath)
    const fileConfig =
      rawConfig === undefined
        ? undefined
        : this.assertConfigShape(rawConfig, configPath)

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

  // Returns the raw parse: the shape is asserted by assertConfigShape, not
  // claimed by a cast here.
  private async readConfigFile(configPath: string): Promise<unknown> {
    try {
      const content = await readFile(configPath, 'utf-8')
      return JSON.parse(content)
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
        this.messages.getMessage('error.configFileUnreadable', [
          configPath,
          error instanceof Error ? error.message : String(error),
        ])
      )
    }
  }

  // The config file is untrusted input: `JSON.parse` returns `any`, so without
  // this the declared shape is a promise the file never had to keep. `lines` is
  // why it matters most — both `validate()` and `parseLineRanges()` walk it with
  // `for...of`, which iterates a STRING character by character, so
  // `"lines": "42"` would silently mutate lines 4 and 2 instead of failing.
  private assertConfigShape(
    config: unknown,
    configPath: string
  ): MutationTestingConfig {
    const result = configSchema.safeParse(config)
    if (result.success) {
      return result.data
    }

    const [issue] = result.error.issues
    // Every issue this schema can raise is an `invalid_type`: it uses only
    // object/array/string/number/boolean, and unknown keys are stripped rather
    // than reported. Narrowing on `issue.code` would add a branch no input can
    // exercise, which the 100% branch-coverage gate would then reject.
    const { expected } = issue as { expected?: string }
    const messageKey =
      MESSAGE_KEY_BY_EXPECTED[String(expected)] ?? CONFIG_ARRAY_MESSAGE_KEY
    throw new Error(
      this.messages.getMessage(messageKey, [
        issue.path.join('.'),
        configPath,
        describeType(valueAtPath(config, issue.path)),
      ])
    )
  }

  public static parseLineRanges(
    lines: string[] | undefined,
    messages: Messages<string>
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
            messages.getMessage('error.invalidLineRange', [range])
          )
        }
        for (let i = start; i <= end; i++) {
          result.add(i)
        }
      } else {
        const value = Number(range)
        if (!Number.isFinite(value)) {
          throw new Error(
            messages.getMessage('error.invalidLineRange', [range])
          )
        }
        result.add(value)
      }
    }
    return result
  }

  public static compileSkipPatterns(
    patterns: string[] | undefined,
    messages: Messages<string>
  ): SkipPattern[] {
    if (!patterns) {
      return []
    }
    return patterns.map(pattern => {
      try {
        return compileSkipPattern(pattern)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(
          messages.getMessage('error.invalidSkipPattern', [pattern, message])
        )
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
      throw new Error(
        this.messages.getMessage('error.mutuallyExclusiveMutators')
      )
    }
    if (parameter.includeTestMethods && parameter.excludeTestMethods) {
      throw new Error(
        this.messages.getMessage('error.mutuallyExclusiveTestMethods')
      )
    }
    // The `!== undefined` half is type narrowing only: `undefined < 0` and
    // `undefined > 100` are both false, so an unset threshold never throws.
    const { threshold } = parameter
    // Stryker disable next-line ConditionalExpression: type narrowing only.
    if (threshold !== undefined && (threshold < 0 || threshold > 100)) {
      throw new Error(this.messages.getMessage('error.thresholdOutOfRange'))
    }
    if (parameter.lines) {
      for (const range of parameter.lines) {
        if (!/^\d+(-\d+)?$/.test(range)) {
          throw new Error(
            this.messages.getMessage('error.invalidLineRange', [range])
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
              this.messages.getMessage('error.invalidLineRangeOrder', [range])
            )
          }
        }
      }
    }
  }
}
