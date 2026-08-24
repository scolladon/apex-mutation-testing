import { readFile } from 'node:fs/promises'

import { Messages } from '@salesforce/core'
import { ConfigReader } from '../../../src/service/configReader.js'
import { ApexMutationParameter } from '../../../src/type/ApexMutationParameter.js'

vi.mock('node:fs/promises')

// Stub compileSkipPattern to throw a non-Error value on demand so the
// String(error) branch inside compileSkipPatterns is covered. The
// Error-throw path is exercised through the real engine (an invalid
// pattern naturally throws), so only the non-Error branch needs a mock.
let skipPatternThrows: false | 'string' = false
vi.mock('../../../src/service/skipPattern.js', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../../src/service/skipPattern.js')>()
  return {
    ...actual,
    compileSkipPattern: (pattern: string) => {
      if (skipPatternThrows === 'string') {
        throw 'string thrown'
      }
      return actual.compileSkipPattern(pattern)
    },
  }
})

describe('ConfigReader', () => {
  let sut: ConfigReader
  let messagesMock: Messages<string>
  const baseParameter: ApexMutationParameter = {
    apexClassName: 'MyClass',
    apexTestClassNames: ['MyClassTest'],
    reportDir: 'reports',
  }

  beforeEach(() => {
    messagesMock = {
      getMessage: vi.fn((key: string, args?: string[]) => {
        const templates: Record<string, string> = {
          'error.blankTestClass': `Blank apex test class name found: '${args?.[0]}'`,
          'error.blankTestSuite': `Blank apex test suite name found: '${args?.[0]}'`,
          'error.invalidClassName': `Invalid Apex class name: '${args?.[0]}'`,
          'error.objectConventionClassName': `Object convention: '${args?.[0]}'`,
          'error.configFileUnreadable': `Failed to parse config file '${args?.[0]}': ${args?.[1]}`,
          'error.configFieldNotStringArray': `Invalid '${args?.[0]}' in config file '${args?.[1]}': expected an array of strings (for example ["90-100"]), found ${args?.[2]}. A bare value is not accepted — wrap it in an array.`,
          'error.configEntryNotString': `Invalid entry at '${args?.[0]}' in config file '${args?.[1]}': expected a string, found ${args?.[2]}.`,
          'error.configFieldNotNumber': `Invalid '${args?.[0]}' in config file '${args?.[1]}': expected a number, found ${args?.[2]}.`,
          'error.configFieldNotBoolean': `Invalid '${args?.[0]}' in config file '${args?.[1]}': expected a boolean, found ${args?.[2]}.`,
          'error.invalidLineRange': `Invalid line range '${args?.[0]}': must be a number or range (e.g., '10' or '1-10')`,
          'error.invalidLineRangeOrder': `Invalid line range '${args?.[0]}': start must be less than or equal to end`,
          'error.invalidSkipPattern': `Invalid skip pattern '${args?.[0]}': ${args?.[1]}`,
          'error.mutuallyExclusiveMutators':
            'Cannot specify both includeMutators and excludeMutators',
          'error.mutuallyExclusiveTestMethods':
            'Cannot specify both includeTestMethods and excludeTestMethods',
          'error.thresholdOutOfRange': 'Threshold must be between 0 and 100',
        }
        return templates[key] || key
      }),
    } as unknown as Messages<string>
    sut = new ConfigReader(messagesMock)
    skipPatternThrows = false
    vi.mocked(readFile).mockRejectedValue({ code: 'ENOENT' })
  })

  it('Given no config file exists, When resolving config, Then returns parameter defaults', async () => {
    // Arrange
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.includeMutators).toBeUndefined()
    expect(result.excludeMutators).toBeUndefined()
    expect(result.includeTestMethods).toBeUndefined()
    expect(result.excludeTestMethods).toBeUndefined()
    expect(result.threshold).toBeUndefined()
  })

  it('Given valid config file with mutator include, When resolving config, Then returns includeMutators from file', async () => {
    // Arrange
    const config = { mutators: { include: ['ArithmeticOperator'] } }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.includeMutators).toEqual(['ArithmeticOperator'])
  })

  it('Given valid config file with testMethods exclude, When resolving config, Then returns excludeTestMethods from file', async () => {
    // Arrange
    const config = { testMethods: { exclude: ['slowTest'] } }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.excludeTestMethods).toEqual(['slowTest'])
  })

  it('Given valid config file with threshold, When resolving config, Then returns threshold from file', async () => {
    // Arrange
    const config = { threshold: 80 }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.threshold).toBe(80)
  })

  it('Given valid config file with mutationGrouping=true, When resolving config, Then returns mutationGrouping=true from file', async () => {
    // Arrange
    const config = { mutationGrouping: true }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.mutationGrouping).toBe(true)
  })

  it('Given CLI flag mutationGrouping=true and no config file, When resolving config, Then resolves to true', async () => {
    // Arrange
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      mutationGrouping: true,
    }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.mutationGrouping).toBe(true)
  })

  it('Given CLI flag mutationGrouping=true and config file mutationGrouping=false, When resolving config, Then CLI flag wins', async () => {
    // Arrange — exercises precedence: CLI value (truthy) overrides config value
    const config = { mutationGrouping: false }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      mutationGrouping: true,
    }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.mutationGrouping).toBe(true)
  })

  it('Given invalid JSON in config file, When resolving config, Then throws parse error', async () => {
    // Arrange
    vi.mocked(readFile).mockResolvedValue('{ invalid json }')
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      /Failed to parse config file/
    )
  })

  it('Given non-Error thrown when reading config, When resolving config, Then wraps it in error message', async () => {
    // Arrange
    vi.mocked(readFile).mockRejectedValue('unexpected string error')
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      /Failed to parse config file.*unexpected string error/
    )
  })

  it('Given CLI flags and config file, When resolving config, Then CLI flags override config file values', async () => {
    // Arrange
    const config = {
      mutators: { include: ['FromFile'] },
      testMethods: { exclude: ['fileExcludeMethod'] },
      threshold: 60,
    }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      includeMutators: ['FromCLI'],
      excludeTestMethods: ['cliExcludeMethod'],
      threshold: 90,
    }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.includeMutators).toEqual(['FromCLI'])
    expect(result.excludeTestMethods).toEqual(['cliExcludeMethod'])
    expect(result.threshold).toBe(90)
  })

  it('Given CLI flags only without config file, When resolving config, Then uses CLI flag values', async () => {
    // Arrange
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      includeMutators: ['FromCLI'],
      threshold: 75,
    }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.includeMutators).toEqual(['FromCLI'])
    expect(result.threshold).toBe(75)
  })

  it('Given config file with both mutators include and exclude, When resolving config, Then throws validation error', async () => {
    // Arrange
    const config = {
      mutators: { include: ['ArithmeticOperator'], exclude: ['Increment'] },
    }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      'Cannot specify both includeMutators and excludeMutators'
    )
  })

  it('Given config file with both testMethods include and exclude, When resolving config, Then throws validation error', async () => {
    // Arrange
    const config = {
      testMethods: { include: ['testA'], exclude: ['testB'] },
    }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      'Cannot specify both includeTestMethods and excludeTestMethods'
    )
  })

  it('Given config file with lines as a bare string, When resolving config, Then rejects the shape instead of walking its characters', async () => {
    // Arrange — `for...of` iterates a string character by character, so this
    // would otherwise pass validation and mutate lines 4 and 2.
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ lines: '42' }))

    // Act & Assert
    await expect(sut.resolve({ ...baseParameter })).rejects.toThrow(
      "Invalid 'lines' in config file '.mutation-testing.json': expected an array of strings (for example [\"90-100\"]), found string."
    )
  })

  it('Given config file with a non-string entry in a string array, When resolving config, Then names the offending entry by index', async () => {
    // Arrange — the second entry is the bad one, so an implementation that
    // reported the field rather than the entry could not produce this path.
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ mutators: { include: ['ArithmeticOperator', 42] } })
    )

    // Act & Assert
    await expect(sut.resolve({ ...baseParameter })).rejects.toThrow(
      "Invalid entry at 'mutators.include.1' in config file '.mutation-testing.json': expected a string, found number."
    )
  })

  it('Given config file with skipPatterns as a bare string, When resolving config, Then rejects the shape naming skipPatterns', async () => {
    // Arrange — pins the field-name argument passed to assertStringArray;
    // without it, an emptied field name would still throw a matching enough
    // message for a loose assertion to miss.
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ skipPatterns: 'System\\.debug' })
    )

    // Act & Assert
    await expect(sut.resolve({ ...baseParameter })).rejects.toThrow(
      "Invalid 'skipPatterns' in config file '.mutation-testing.json': expected an array of strings (for example [\"90-100\"]), found string."
    )
  })

  it('Given config file with mutators.exclude as a bare string, When resolving config, Then rejects the shape naming mutators.exclude', async () => {
    // Arrange
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ mutators: { exclude: 'ArithmeticOperator' } })
    )

    // Act & Assert
    await expect(sut.resolve({ ...baseParameter })).rejects.toThrow(
      "Invalid 'mutators.exclude' in config file '.mutation-testing.json': expected an array of strings (for example [\"90-100\"]), found string."
    )
  })

  it('Given config file with testMethods.include as a bare string, When resolving config, Then rejects the shape naming testMethods.include', async () => {
    // Arrange
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ testMethods: { include: 'ArithmeticOperator' } })
    )

    // Act & Assert
    await expect(sut.resolve({ ...baseParameter })).rejects.toThrow(
      "Invalid 'testMethods.include' in config file '.mutation-testing.json': expected an array of strings (for example [\"90-100\"]), found string."
    )
  })

  it('Given config file with testMethods.exclude as a bare string, When resolving config, Then rejects the shape naming testMethods.exclude', async () => {
    // Arrange
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ testMethods: { exclude: 'ArithmeticOperator' } })
    )

    // Act & Assert
    await expect(sut.resolve({ ...baseParameter })).rejects.toThrow(
      "Invalid 'testMethods.exclude' in config file '.mutation-testing.json': expected an array of strings (for example [\"90-100\"]), found string."
    )
  })

  it('Given config file with threshold as a string, When resolving config, Then rejects the shape', async () => {
    // Arrange
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ threshold: '50' }))

    // Act & Assert
    await expect(sut.resolve({ ...baseParameter })).rejects.toThrow(
      "Invalid 'threshold' in config file '.mutation-testing.json': expected a number, found string."
    )
  })

  it('Given config file with threshold as an array, When resolving config, Then names the array rather than reporting object', async () => {
    // Arrange — `typeof []` is 'object', which tells the reader nothing about
    // what they wrote; the message has to say it was an array.
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ threshold: [50] }))

    // Act & Assert
    await expect(sut.resolve({ ...baseParameter })).rejects.toThrow(
      "Invalid 'threshold' in config file '.mutation-testing.json': expected a number, found an array."
    )
  })

  it('Given config file with mutationGrouping as a string, When resolving config, Then rejects the shape', async () => {
    // Arrange
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ mutationGrouping: 'yes' })
    )

    // Act & Assert
    await expect(sut.resolve({ ...baseParameter })).rejects.toThrow(
      "Invalid 'mutationGrouping' in config file '.mutation-testing.json': expected a boolean, found string."
    )
  })

  it('Given config file with every field correctly shaped, When resolving config, Then accepts it', async () => {
    // Arrange — the negative cases above must not be passing for a trivial
    // reason: the same fields in their declared shapes have to survive.
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({
        lines: ['1-3'],
        skipPatterns: ['System\\.debug'],
        mutators: { include: ['ArithmeticOperator'] },
        testMethods: { include: ['MyClassTest.testOne'] },
        threshold: 50,
        mutationGrouping: true,
      })
    )

    // Act
    const result = await sut.resolve({ ...baseParameter })

    // Assert
    expect(result.lines).toEqual(['1-3'])
    expect(result.threshold).toBe(50)
    expect(result.mutationGrouping).toBe(true)
  })

  it('Given config file with threshold below 0, When resolving config, Then throws validation error', async () => {
    // Arrange
    const config = { threshold: -1 }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      'Threshold must be between 0 and 100'
    )
  })

  it('Given config file with threshold above 100, When resolving config, Then throws validation error', async () => {
    // Arrange
    const config = { threshold: 101 }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      'Threshold must be between 0 and 100'
    )
  })

  it('Given explicit configFile path that exists, When resolving config, Then reads from that path', async () => {
    // Arrange
    const config = { threshold: 50 }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      configFile: 'custom/config.json',
    }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(readFile).toHaveBeenCalledWith('custom/config.json', 'utf-8')
    expect(result.threshold).toBe(50)
  })

  it('Given config file with valid lines ranges, When resolving config, Then returns lines from file', async () => {
    // Arrange
    const config = { lines: ['1-10', '25-30', '42'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.lines).toEqual(['1-10', '25-30', '42'])
  })

  it('Given CLI lines and config file lines, When resolving config, Then CLI lines override config file', async () => {
    // Arrange
    const config = { lines: ['1-10'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      lines: ['50-60'],
    }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.lines).toEqual(['50-60'])
  })

  it('Given config file with invalid line range format, When resolving config, Then throws validation error naming the offending range', async () => {
    // Arrange — asserts the full rendered sentence, not just a loose
    // /Invalid line range/ match: a getMessage([range]) → getMessage([])
    // mutant still renders "Invalid line range 'undefined': ..." which the
    // loose regex could not tell apart from the real range.
    const config = { lines: ['abc'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      "Invalid line range 'abc': must be a number or range (e.g., '10' or '1-10')"
    )
  })

  it('Given config file with reversed line range, When resolving config, Then throws validation error naming the offending range', async () => {
    // Arrange — same rationale as above, for the invalidLineRangeOrder branch.
    const config = { lines: ['10-5'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      "Invalid line range '10-5': start must be less than or equal to end"
    )
  })

  it('Given config file with single line number, When resolving config, Then accepts it', async () => {
    // Arrange
    const config = { lines: ['42'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.lines).toEqual(['42'])
  })

  it('Given no configFile parameter, When resolving config, Then reads default .mutation-testing.json', async () => {
    // Arrange — kills DEFAULT_CONFIG_FILE → "" mutant
    const parameter = { ...baseParameter }

    // Act
    await sut.resolve(parameter)

    // Assert — must use the literal default filename, not empty string
    expect(readFile).toHaveBeenCalledWith('.mutation-testing.json', 'utf-8')
  })

  it('Given non-ENOENT error reading config file, When resolving config, Then rethrows as wrapped error', async () => {
    // Arrange — kills error.code === 'ENOENT' → true mutant
    vi.mocked(readFile).mockRejectedValue({
      code: 'EACCES',
      message: 'Permission denied',
    })
    const parameter = { ...baseParameter }

    // Act & Assert — EACCES must NOT be silently swallowed as undefined
    await expect(sut.resolve(parameter)).rejects.toThrow(
      /Failed to parse config file/
    )
  })

  it('Given threshold of exactly 0, When resolving config, Then does not throw', async () => {
    // Arrange — kills threshold < 0 → <= 0 mutant: 0 is valid
    const parameter: ApexMutationParameter = { ...baseParameter, threshold: 0 }

    // Act & Assert
    await expect(sut.resolve(parameter)).resolves.not.toThrow()
  })

  it('Given threshold of exactly 100, When resolving config, Then does not throw', async () => {
    // Arrange — kills threshold > 100 → >= 100 mutant: 100 is valid
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      threshold: 100,
    }

    // Act & Assert
    await expect(sut.resolve(parameter)).resolves.not.toThrow()
  })

  it('Given threshold undefined, When resolving config, Then threshold validation is skipped', async () => {
    // Arrange — kills threshold !== undefined → true mutant
    // If validation ran unconditionally, valid param would be invalid because check would run
    const parameter = { ...baseParameter }

    // Act & Assert — no threshold means no validation error
    await expect(sut.resolve(parameter)).resolves.toBeDefined()
  })

  it('Given line range with trailing non-digit characters, When resolving config, Then throws validation error', async () => {
    // Arrange — kills $ anchor removal mutant: "123abc" passes /^\d+(-\d+)?/ without $
    const config = { lines: ['123abc'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(/Invalid line range/)
  })

  it('Given line range with leading non-digit characters, When resolving config, Then throws validation error', async () => {
    // Arrange — kills ^ anchor removal mutant: "abc123" passes /\d+(-\d+)?$/ without ^
    const config = { lines: ['abc123'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(/Invalid line range/)
  })

  it('Given line range where start equals end, When resolving config, Then does not throw', async () => {
    // Arrange — kills start > end → start >= end mutant: 5-5 is valid (equal is OK)
    const config = { lines: ['5-5'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).resolves.not.toThrow()
  })

  it('Given line range without dash (single number), When includes check runs, Then takes else branch', async () => {
    // Arrange — kills range.includes('-') → range.includes('') mutant
    // includes('') always returns true, so single number '42' would be treated as a dash-range
    const config = { lines: ['42'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert — '42' is valid single number; parsed set should include 42
    const parsed = ConfigReader.parseLineRanges(result.lines, messagesMock)
    expect(parsed).toEqual(new Set([42]))
  })

  it('Given only includeMutators set (no excludeMutators), When resolving config, Then does not throw (kills includeMutators&&true mutation)', async () => {
    // Arrange — kills "parameter.includeMutators && true" ConditionalExpression mutant:
    // if excludeMutators were replaced by `true`, this would throw even with only include set
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      includeMutators: ['ArithmeticOperator'],
    }

    // Act & Assert
    await expect(sut.resolve(parameter)).resolves.not.toThrow()
  })

  it('Given only excludeMutators set (no includeMutators), When resolving config, Then does not throw (kills true&&excludeMutators mutation)', async () => {
    // Arrange — kills "true && parameter.excludeMutators" ConditionalExpression mutant:
    // if includeMutators were replaced by `true`, this would throw even with only exclude set
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      excludeMutators: ['Increment'],
    }

    // Act & Assert
    await expect(sut.resolve(parameter)).resolves.not.toThrow()
  })

  it('Given only includeTestMethods set (no excludeTestMethods), When resolving config, Then does not throw (kills includeTestMethods&&true mutation)', async () => {
    // Arrange — kills "parameter.includeTestMethods && true" ConditionalExpression mutant
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      includeTestMethods: ['myTest'],
    }

    // Act & Assert
    await expect(sut.resolve(parameter)).resolves.not.toThrow()
  })

  it('Given only excludeTestMethods set (no includeTestMethods), When resolving config, Then does not throw (kills true&&excludeTestMethods mutation)', async () => {
    // Arrange — kills "true && parameter.excludeTestMethods" ConditionalExpression mutant
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      excludeTestMethods: ['slowTest'],
    }

    // Act & Assert
    await expect(sut.resolve(parameter)).resolves.not.toThrow()
  })

  it('Given error object without code property when reading config, When resolving config, Then throws wrapped error', async () => {
    // Arrange — kills 'code' in error → true ConditionalExpression mutant:
    // an error object without 'code' should not be silently swallowed
    vi.mocked(readFile).mockRejectedValue({
      message: 'some error without code',
    })
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      /Failed to parse config file/
    )
  })

  it('Given falsy error value when reading config, When resolving config, Then throws wrapped error', async () => {
    // Arrange — kills error && ... → true && ... ConditionalExpression mutant:
    // a falsy error (null) should not be silently swallowed as ENOENT
    vi.mocked(readFile).mockRejectedValue(null)
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      /Failed to parse config file/
    )
  })

  it('Given non-object error when reading config, When resolving config, Then throws wrapped error', async () => {
    // Arrange — kills typeof error === 'object' → true ConditionalExpression mutant:
    // a non-object error (number) should not be silently swallowed as ENOENT
    vi.mocked(readFile).mockRejectedValue(42)
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      /Failed to parse config file/
    )
  })

  it('Given config file with valid lines, When resolving config, Then lines are accepted', async () => {
    // Arrange — kills parameter.lines truthy check → true: without this guard, undefined lines
    // would cause the for loop to crash on undefined
    const config = { lines: ['1-5'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.lines).toEqual(['1-5'])
  })

  it('Given no lines in config or CLI, When resolving config, Then no validation error is thrown (kills lines&&true guard)', async () => {
    // Arrange — kills if (parameter.lines) → if (true) mutation:
    // if the guard were removed, iterating undefined.lines would crash
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).resolves.not.toThrow()
  })

  it('Given config file with valid skipPatterns, When resolving config, Then returns skipPatterns from file', async () => {
    // Arrange
    const config = { skipPatterns: ['System\\.debug', 'Logger\\.'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.skipPatterns).toEqual(['System\\.debug', 'Logger\\.'])
  })

  it('Given CLI skipPatterns and config file skipPatterns, When resolving config, Then CLI overrides config file', async () => {
    // Arrange
    const config = { skipPatterns: ['FromFile'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      skipPatterns: ['FromCLI'],
    }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.skipPatterns).toEqual(['FromCLI'])
  })

  it('Given skip patterns with invalid regex, When compiling, Then throws error', () => {
    // Act & Assert
    expect(() =>
      ConfigReader.compileSkipPatterns(['([unclosed'], messagesMock)
    ).toThrow(/Invalid skip pattern '\(\[unclosed': error parsing regexp/)
  })

  it('Given skip patterns with non-Error throw, When compiling, Then wraps it in error message', () => {
    // Arrange
    skipPatternThrows = 'string'

    // Act & Assert
    expect(() =>
      ConfigReader.compileSkipPatterns(['some-pattern'], messagesMock)
    ).toThrow(/Invalid skip pattern 'some-pattern': string thrown/)
  })

  describe('perimeter normalization', () => {
    it('Given test class names with surrounding whitespace, When resolving config, Then trims each name', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['  A  ', 'B'],
      }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['A', 'B'])
    })

    it('Given a blank test class name, When resolving config, Then throws naming the offending raw input', async () => {
      // Arrange — whitespace-only, not '', so raw ('   ') and trimmed ('')
      // differ: this pins the error to the raw argument specifically.
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['A', '   ', 'B'],
      }

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Blank apex test class name found: '   '"
      )
      expect(messagesMock.getMessage).toHaveBeenCalledWith(
        'error.blankTestClass',
        ['   ']
      )
    })

    it('Given case-insensitive duplicate test class names, When resolving config, Then keeps only the first-seen spelling', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['A', 'a'],
      }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['A'])
    })

    it('Given test class names out of alphabetical order, When resolving config, Then preserves user order', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['B', 'A'],
      }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['B', 'A'])
    })

    it('Given a single test class name, When resolving config, Then the perimeter passes through unchanged', async () => {
      // Arrange — single-element perimeter is byte-identical to input
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['MyClassTest'],
      }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['MyClassTest'])
    })

    it('Given a bare name, its namespace-qualified spelling, and a case-variant of the qualified spelling, When resolving config, Then the qualified spelling dedupes against its own case variant but stays distinct from the bare name', async () => {
      // Arrange — a qualified spelling is a distinct dedup key from its
      // bare counterpart on purpose: they are different classes. A
      // case-variant of the same qualified spelling still folds together.
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['Foo', 'mockery.Foo', 'MOCKERY.FOO'],
      }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['Foo', 'mockery.Foo'])
    })

    it('Given a config file carrying a testClass-ish key, When resolving config, Then the file key has no effect on the perimeter', async () => {
      // Arrange — MutationTestingConfig declares no test-class key
      const config = { testClass: 'FromFileShouldBeIgnored' }
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['CliClass'],
      }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['CliClass'])
    })
  })

  describe('class name validation', () => {
    it('Given a test class name ending in a backslash, When resolving config, Then throws naming the offending input', async () => {
      // Arrange — the Tooling API literal builder escapes quotes but not
      // backslashes, so a trailing backslash escapes the closing quote and
      // the literal runs on into the rest of the WHERE clause.
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['Foo\\'],
      }

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Invalid Apex class name: 'Foo\\'"
      )
      expect(messagesMock.getMessage).toHaveBeenCalledWith(
        'error.invalidClassName',
        ['Foo\\']
      )
    })

    it('Given a class under mutation ending in a backslash, When resolving config, Then throws naming the offending input', async () => {
      // Arrange — -c reaches the same Tooling API query as the perimeter
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexClassName: 'Foo\\',
      }

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Invalid Apex class name: 'Foo\\'"
      )
    })

    it('Given a test class name with an underscore and a digit, When resolving config, Then accepts it', async () => {
      // Arrange — guards against an over-tight rule rejecting real names
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['Logger_Tests2'],
      }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['Logger_Tests2'])
    })

    it('Given a single-letter test class name, When resolving config, Then accepts it', async () => {
      // Arrange — the tail is optional: a one-character identifier is legal
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['A'],
      }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['A'])
    })

    it('Given a dotted namespace-qualified name for the class under mutation and for a perimeter entry, When resolving config, Then resolves without throwing and echoes both spellings verbatim', async () => {
      // Arrange — the grammar now admits exactly one namespace qualifier,
      // so a dotted spelling resolves locally instead of failing before
      // ever reaching the org.
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexClassName: 'mockery.Argument',
        apexTestClassNames: ['mockery.ArgumentTest'],
      }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexClassName).toBe('mockery.Argument')
      expect(result.apexTestClassNames).toEqual(['mockery.ArgumentTest'])
    })

    it.each(['a.b.c', '.Foo', 'Foo.', 'ns..Foo'])(
      'Given the malformed dotted name %s, When resolving config, Then throws the invalid-name message (kills a widened optional-group mutant)',
      async name => {
        // Arrange
        const parameter: ApexMutationParameter = {
          ...baseParameter,
          apexTestClassNames: [name],
        }

        // Act & Assert
        await expect(sut.resolve(parameter)).rejects.toThrow(
          `Invalid Apex class name: '${name}'`
        )
      }
    )

    it("Given a class name using the object convention 'ns__Class', When resolving config, Then throws the object-convention message naming the offending input", async () => {
      // Arrange — the object convention is uncompilable as an Apex class
      // name, so it can only be a mistaken spelling of the dotted form
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['namespaced__Mutation'],
      }

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Object convention: 'namespaced__Mutation'"
      )
      expect(messagesMock.getMessage).toHaveBeenCalledWith(
        'error.objectConventionClassName',
        ['namespaced__Mutation']
      )
    })

    it('Given a class name with a single underscore, When resolving config, Then accepts it (not the object convention)', async () => {
      // Arrange — a single underscore is the ordinary identifier
      // separator; only a double underscore is the object convention
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['Foo_Bar'],
      }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['Foo_Bar'])
    })

    it('Given a name that fails the grammar and also uses the object convention, When resolving config, Then throws the grammar message because the grammar check runs first', async () => {
      // Arrange — pins check ORDER: a name failing both rules must report
      // the generic grammar message, not the object-convention one
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['1namespaced__Mutation'],
      }

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Invalid Apex class name: '1namespaced__Mutation'"
      )
    })

    it('Given a test class name starting with a digit, When resolving config, Then throws', async () => {
      // Arrange — an identifier may not open with a digit
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['1Foo'],
      }

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Invalid Apex class name: '1Foo'"
      )
    })

    it('Given a test class name embedding a quote and a clause, When resolving config, Then throws', async () => {
      // Arrange — the break-out shape: backslash then quote closes the
      // literal, leaving the rest of the input as query text.
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ["Foo\\' OR Id != null"],
      }

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Invalid Apex class name: 'Foo\\' OR Id != null'"
      )
    })

    it('Given a test class name with a trailing newline, When resolving config, Then throws', async () => {
      // Arrange — the rule matches the whole name, not just its first line
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['Foo\nBar'],
      }

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        'Invalid Apex class name'
      )
    })

    it('Given an invalid name repeated in different case, When resolving config, Then throws once naming the first-seen spelling', async () => {
      // Arrange — validation runs on the deduped perimeter; three segments
      // stay invalid even under the widened grammar
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['ns.sub.Foo', 'NS.SUB.FOO'],
      }

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Invalid Apex class name: 'ns.sub.Foo'"
      )
    })
  })

  describe('suite name normalization', () => {
    it('Given a blank test suite name, When resolving config, Then throws naming the offending raw input', async () => {
      // Arrange — whitespace-only, not '', so raw ('   ') and trimmed ('')
      // differ: this pins the error to the raw argument specifically.
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestSuiteNames: ['A', '   ', 'B'],
      }

      // Act & Assert
      await expect(sut.resolve(parameter)).rejects.toThrow(
        "Blank apex test suite name found: '   '"
      )
      expect(messagesMock.getMessage).toHaveBeenCalledWith(
        'error.blankTestSuite',
        ['   ']
      )
    })

    it('Given class and suite names differing only by case, When resolving config, Then class names dedupe case-insensitively but suite names both survive', async () => {
      // Arrange — the org matches ApexClass.Name case-insensitively but
      // ApexTestSuite.TestSuiteName case-sensitively, so the two dedupe
      // rules must diverge on the same input.
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestClassNames: ['FooTest', 'footest'],
        apexTestSuiteNames: ['Foo', 'foo'],
      }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestClassNames).toEqual(['FooTest'])
      expect(result.apexTestSuiteNames).toEqual(['Foo', 'foo'])
      expect(result.apexTestSuiteNames).not.toBe(parameter.apexTestSuiteNames)
    })

    it('Given test suite names with whitespace and an exact duplicate, When resolving config, Then trims, dedupes exact matches and preserves user order', async () => {
      // Arrange
      const parameter: ApexMutationParameter = {
        ...baseParameter,
        apexTestSuiteNames: ['  Beta  ', 'Alpha', 'Beta'],
      }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestSuiteNames).toEqual(['Beta', 'Alpha'])
    })

    it('Given no test suite names, When resolving config, Then normalizes to an empty list', async () => {
      // Arrange
      const parameter: ApexMutationParameter = { ...baseParameter }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.apexTestSuiteNames).toEqual([])
    })
  })

  describe('test method filter pass-through', () => {
    // ConfigReader must not touch a namespace-qualified filter entry:
    // matchesFilter (mutationTestingService.ts) already resolves a
    // three-segment entry like 'mockery.ArgumentTest.testFoo' through
    // testClassResolutions' qualified lookupKeys. Stripping the namespace
    // segment here contradicted that contract — it reduced the entry to a
    // two-segment form no class resolves to, silently selecting zero
    // methods. All three arities appear together so a regression that only
    // strips one arity cannot hide behind a fixture that exercises just
    // that arm.
    const qualifiedFilters = [
      'mockery.ArgumentTest.testFoo',
      'ArgumentTest.testBar',
      'testBaz',
    ]

    it.each(['includeTestMethods', 'excludeTestMethods'] as const)(
      'Given a three-segment, a two-segment and a bare entry in %s, When resolving config, Then every entry passes through unchanged',
      async field => {
        // Arrange
        const parameter: ApexMutationParameter = {
          ...baseParameter,
          [field]: qualifiedFilters,
        }

        // Act
        const result = await sut.resolve(parameter)

        // Assert
        expect(result[field]).toEqual(qualifiedFilters)
      }
    )

    it('Given a three-segment entry sourced from the config file rather than the flag, When resolving config, Then it passes through unchanged the same way', async () => {
      // Arrange
      const config = { testMethods: { include: qualifiedFilters } }
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
      const parameter = { ...baseParameter }

      // Act
      const result = await sut.resolve(parameter)

      // Assert
      expect(result.includeTestMethods).toEqual(qualifiedFilters)
    })
  })

  describe('parseLineRanges', () => {
    it('Given single line number, When parsing, Then returns set with that number', () => {
      // Arrange & Act
      const sut = ConfigReader.parseLineRanges(['42'], messagesMock)

      // Assert
      expect(sut).toEqual(new Set([42]))
    })

    it('Given range, When parsing, Then returns expanded set', () => {
      // Arrange & Act
      const sut = ConfigReader.parseLineRanges(['1-3'], messagesMock)

      // Assert
      expect(sut).toEqual(new Set([1, 2, 3]))
    })

    it('Given multiple ranges and singles, When parsing, Then returns combined set', () => {
      // Arrange & Act
      const sut = ConfigReader.parseLineRanges(
        ['1-3', '10', '20-22'],
        messagesMock
      )

      // Assert
      expect(sut).toEqual(new Set([1, 2, 3, 10, 20, 21, 22]))
    })

    it('Given a range with a non-numeric bound, When parsing, Then throws', () => {
      // Arrange & Act & Assert — only one side is unparseable, so requiring
      // BOTH bounds to be non-finite would let this through and silently
      // produce an empty range instead of reporting the bad input.
      expect(() =>
        ConfigReader.parseLineRanges(['5-abc'], messagesMock)
      ).toThrow(/Invalid line range '5-abc'/)
    })

    it('Given undefined, When parsing, Then returns undefined', () => {
      // Arrange & Act
      const sut = ConfigReader.parseLineRanges(undefined, messagesMock)

      // Assert
      expect(sut).toBeUndefined()
    })

    it('Given empty array, When parsing, Then returns undefined', () => {
      // Arrange & Act
      const sut = ConfigReader.parseLineRanges([], messagesMock)

      // Assert
      expect(sut).toBeUndefined()
    })

    it('Given a non-numeric range bound, When parsing, Then throws (defensive NaN guard)', () => {
      // Arrange & Act & Assert — H4 hardening: the static method must reject
      // NaN inputs itself, not rely on a prior validate() pass.
      expect(() =>
        ConfigReader.parseLineRanges(['foo-bar'], messagesMock)
      ).toThrow(/Invalid line range 'foo-bar'/)
    })

    it('Given a non-numeric single value, When parsing, Then throws', () => {
      // Arrange & Act & Assert
      expect(() => ConfigReader.parseLineRanges(['abc'], messagesMock)).toThrow(
        /Invalid line range 'abc'/
      )
    })

    it('Given an inverted range (start > end), When parsing, Then throws', () => {
      // Arrange & Act & Assert
      expect(() =>
        ConfigReader.parseLineRanges(['10-5'], messagesMock)
      ).toThrow(/Invalid line range '10-5'/)
    })

    it('Given overlapping ranges, When parsing, Then returns deduplicated set', () => {
      // Arrange & Act
      const sut = ConfigReader.parseLineRanges(['1-5', '3-8'], messagesMock)

      // Assert
      expect(sut).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]))
    })

    it('Given non-empty array, When parsing, Then returns defined set (kills lines.length === 0 → true ConditionalExpression)', () => {
      // Arrange — kills `lines.length === 0` → `true` mutant:
      // With true, non-empty arrays are also treated as empty → returns undefined
      // Original: only empty arrays return undefined.

      // Act
      const sut = ConfigReader.parseLineRanges(['5'], messagesMock)

      // Assert — non-empty array must return a Set, not undefined
      expect(sut).not.toBeUndefined()
      expect(sut).toBeInstanceOf(Set)
    })

    it('Given range string with dash, When parsing, Then iterates from start to end (kills i <= end → i < end)', () => {
      // Arrange — kills `i <= end` → `i < end` mutant: with `<`, end value is excluded.
      // With `<=`, 1-3 produces {1, 2, 3}; with `<`, produces {1, 2}.

      // Act
      const sut = ConfigReader.parseLineRanges(['1-3'], messagesMock)

      // Assert — end must be included
      expect(sut).toContain(3)
      expect(sut?.size).toBe(3)
    })

    it('Given range with equal start and end, When parsing, Then returns set with single value (kills i <= end boundary)', () => {
      // Arrange — reinforces i <= end: with i < end, 5-5 would produce empty set
      // because i=5 < 5 is false immediately.

      // Act
      const sut = ConfigReader.parseLineRanges(['5-5'], messagesMock)

      // Assert
      expect(sut).toEqual(new Set([5]))
    })
  })

  describe('compileSkipPatterns', () => {
    it('Given undefined, When compiling, Then returns empty array', () => {
      // Arrange & Act
      const sut = ConfigReader.compileSkipPatterns(undefined, messagesMock)

      // Assert
      expect(sut).toEqual([])
    })

    it('Given patterns, When compiling, Then returns SkipPattern instances', () => {
      // Arrange & Act
      const sut = ConfigReader.compileSkipPatterns(
        ['System\\.debug', 'Logger\\.'],
        messagesMock
      )

      // Assert
      expect(sut).toHaveLength(2)
      expect(sut[0].test('System.debug(x)')).toBe(true)
    })
  })
})
