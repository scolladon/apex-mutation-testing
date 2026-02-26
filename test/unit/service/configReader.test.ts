import { readFile } from 'node:fs/promises'

import { ConfigReader } from '../../../src/service/configReader.js'
import { ApexMutationParameter } from '../../../src/type/ApexMutationParameter.js'

jest.mock('node:fs/promises')

describe('ConfigReader', () => {
  let sut: ConfigReader
  const baseParameter: ApexMutationParameter = {
    apexClassName: 'MyClass',
    apexTestClassName: 'MyClassTest',
    reportDir: 'reports',
  }

  beforeEach(() => {
    sut = new ConfigReader()
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

  it('Given CLI flags and config file, When resolving config, Then CLI flags override config file values', async () => {
    // Arrange
    const config = {
      mutators: { include: ['FromFile'], exclude: ['FromFileExclude'] },
      testMethods: {
        include: ['fileTestMethod'],
        exclude: ['fileExcludeMethod'],
      },
      threshold: 60,
    }
    ;(readFile as jest.Mock).mockResolvedValue(JSON.stringify(config))
    const parameter: ApexMutationParameter = {
      ...baseParameter,
      includeMutators: ['FromCLI'],
      excludeMutators: ['FromCLIExclude'],
      includeTestMethods: ['cliTestMethod'],
      excludeTestMethods: ['cliExcludeMethod'],
      threshold: 90,
    }

    // Act
    const result = await sut.resolve(parameter)

    // Assert
    expect(result.includeMutators).toEqual(['FromCLI'])
    expect(result.excludeMutators).toEqual(['FromCLIExclude'])
    expect(result.includeTestMethods).toEqual(['cliTestMethod'])
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
})
