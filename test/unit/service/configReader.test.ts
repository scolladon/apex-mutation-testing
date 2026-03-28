import { readFile } from 'node:fs/promises'

import { ConfigReader } from '../../../src/service/configReader.js'
import { ApexMutationParameter } from '../../../src/type/ApexMutationParameter.js'

vi.mock('node:fs/promises')

let re2Behavior: 'noop' | 'throw-error' | 'throw-string' = 'noop'
vi.mock('re2', () => ({
  default: function MockRE2() {
    if (re2Behavior === 'throw-error') {
      throw new Error('invalid regex')
    }
    if (re2Behavior === 'throw-string') {
      throw 'string thrown'
    }
  },
}))

describe('ConfigReader', () => {
  let sut: ConfigReader
  const baseParameter: ApexMutationParameter = {
    apexClassName: 'MyClass',
    apexTestClassName: 'MyClassTest',
    reportDir: 'reports',
  }

  beforeEach(() => {
    sut = new ConfigReader()
    re2Behavior = 'noop'
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

  it('Given config file with invalid line range format, When resolving config, Then throws validation error', async () => {
    // Arrange
    const config = { lines: ['abc'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(/Invalid line range/)
  })

  it('Given config file with reversed line range, When resolving config, Then throws validation error', async () => {
    // Arrange
    const config = { lines: ['10-5'] }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      /start must be less than or equal to end/
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
    const parsed = ConfigReader.parseLineRanges(result.lines)
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
    // Arrange
    re2Behavior = 'throw-error'

    // Act & Assert
    expect(() => ConfigReader.compileSkipPatterns(['([unclosed'])).toThrow(
      /Invalid skip pattern '\(\[unclosed': invalid regex/
    )
  })

  it('Given skip patterns with non-Error throw, When compiling, Then wraps it in error message', () => {
    // Arrange
    re2Behavior = 'throw-string'

    // Act & Assert
    expect(() => ConfigReader.compileSkipPatterns(['some-pattern'])).toThrow(
      /Invalid skip pattern 'some-pattern': string thrown/
    )
  })

  describe('parseLineRanges', () => {
    it('Given single line number, When parsing, Then returns set with that number', () => {
      // Arrange & Act
      const sut = ConfigReader.parseLineRanges(['42'])

      // Assert
      expect(sut).toEqual(new Set([42]))
    })

    it('Given range, When parsing, Then returns expanded set', () => {
      // Arrange & Act
      const sut = ConfigReader.parseLineRanges(['1-3'])

      // Assert
      expect(sut).toEqual(new Set([1, 2, 3]))
    })

    it('Given multiple ranges and singles, When parsing, Then returns combined set', () => {
      // Arrange & Act
      const sut = ConfigReader.parseLineRanges(['1-3', '10', '20-22'])

      // Assert
      expect(sut).toEqual(new Set([1, 2, 3, 10, 20, 21, 22]))
    })

    it('Given undefined, When parsing, Then returns undefined', () => {
      // Arrange & Act
      const sut = ConfigReader.parseLineRanges(undefined)

      // Assert
      expect(sut).toBeUndefined()
    })

    it('Given empty array, When parsing, Then returns undefined', () => {
      // Arrange & Act
      const sut = ConfigReader.parseLineRanges([])

      // Assert
      expect(sut).toBeUndefined()
    })

    it('Given overlapping ranges, When parsing, Then returns deduplicated set', () => {
      // Arrange & Act
      const sut = ConfigReader.parseLineRanges(['1-5', '3-8'])

      // Assert
      expect(sut).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]))
    })
  })

  describe('compileSkipPatterns', () => {
    it('Given undefined, When compiling, Then returns empty array', () => {
      // Arrange & Act
      const sut = ConfigReader.compileSkipPatterns(undefined)

      // Assert
      expect(sut).toEqual([])
    })

    it('Given patterns, When compiling, Then returns RE2 instances', () => {
      // Arrange & Act
      const sut = ConfigReader.compileSkipPatterns([
        'System\\.debug',
        'Logger\\.',
      ])

      // Assert
      expect(sut).toHaveLength(2)
    })
  })
})
