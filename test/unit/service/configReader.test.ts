import { readFile } from 'node:fs/promises'

import { ConfigReader } from '../../../src/service/configReader.js'
import { ApexMutationParameter } from '../../../src/type/ApexMutationParameter.js'

jest.mock('node:fs/promises')

let re2Behavior: 'noop' | 'throw-error' | 'throw-string' = 'noop'
jest.mock('re2', () => {
  return function MockRE2() {
    if (re2Behavior === 'throw-error') {
      throw new Error('invalid regex')
    }
    if (re2Behavior === 'throw-string') {
      throw 'string thrown'
    }
  }
})

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
    ;(readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' })
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
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.includeMutators).toEqual(['ArithmeticOperator'])
  })

  it('Given valid config file with testMethods exclude, When resolving config, Then returns excludeTestMethods from file', async () => {
    // Arrange
    const config = { testMethods: { exclude: ['slowTest'] } }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.excludeTestMethods).toEqual(['slowTest'])
  })

  it('Given valid config file with threshold, When resolving config, Then returns threshold from file', async () => {
    // Arrange
    const config = { threshold: 80 }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.threshold).toBe(80)
  })

  it('Given invalid JSON in config file, When resolving config, Then throws parse error', async () => {
    // Arrange
    ;(readFile as jest.Mock).mockResolvedValue('{ invalid json }')
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      /Failed to parse config file/
    )
  })

  it('Given non-Error thrown when reading config, When resolving config, Then wraps it in error message', async () => {
    // Arrange
    ;(readFile as jest.Mock).mockRejectedValue('unexpected string error')
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
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
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
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
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
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      'Cannot specify both includeTestMethods and excludeTestMethods'
    )
  })

  it('Given config file with threshold below 0, When resolving config, Then throws validation error', async () => {
    // Arrange
    const config = { threshold: -1 }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      'Threshold must be between 0 and 100'
    )
  })

  it('Given config file with threshold above 100, When resolving config, Then throws validation error', async () => {
    // Arrange
    const config = { threshold: 101 }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      'Threshold must be between 0 and 100'
    )
  })

  it('Given config file with both mutators include and exclude, When resolving config, Then throws validation error', async () => {
    // Arrange
    const config = {
      mutators: { include: ['ArithmeticOperator'], exclude: ['Increment'] },
    }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
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
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      'Cannot specify both includeTestMethods and excludeTestMethods'
    )
  })

  it('Given explicit configFile path that exists, When resolving config, Then reads from that path', async () => {
    // Arrange
    const config = { threshold: 50 }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
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
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.lines).toEqual(['1-10', '25-30', '42'])
  })

  it('Given CLI lines and config file lines, When resolving config, Then CLI lines override config file', async () => {
    // Arrange
    const config = { lines: ['1-10'] }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
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
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(/Invalid line range/)
  })

  it('Given config file with reversed line range, When resolving config, Then throws validation error', async () => {
    // Arrange
    const config = { lines: ['10-5'] }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      /start must be less than or equal to end/
    )
  })

  it('Given config file with single line number, When resolving config, Then accepts it', async () => {
    // Arrange
    const config = { lines: ['42'] }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.lines).toEqual(['42'])
  })

  it('Given config file with valid skipPatterns, When resolving config, Then returns skipPatterns from file', async () => {
    // Arrange
    const config = { skipPatterns: ['System\\.debug', 'Logger\\.'] }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.skipPatterns).toEqual(['System\\.debug', 'Logger\\.'])
  })

  it('Given CLI skipPatterns and config file skipPatterns, When resolving config, Then CLI overrides config file', async () => {
    // Arrange
    const config = { skipPatterns: ['FromFile'] }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      skipPatterns: ['FromCLI'],
    }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.skipPatterns).toEqual(['FromCLI'])
  })

  it('Given config file with invalid regex in skipPatterns, When resolving config, Then throws validation error', async () => {
    // Arrange
    re2Behavior = 'throw-error'
    const config = { skipPatterns: ['([unclosed'] }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
      /Invalid skip pattern '\(\[unclosed': invalid regex/
    )
  })

  it('Given config file with skipPattern that throws non-Error, When resolving config, Then wraps it in error message', async () => {
    // Arrange
    re2Behavior = 'throw-string'
    const config = { skipPatterns: ['some-pattern'] }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter = { ...baseParameter }

    // Act & Assert
    await expect(sut.resolve(parameter)).rejects.toThrow(
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
