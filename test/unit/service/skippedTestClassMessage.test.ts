import { Messages } from '@salesforce/core'
import {
  formatSkippedTestClass,
  formatSkippedTestClasses,
} from '../../../src/service/skippedTestClassMessage.js'
import { SkippedTestClass } from '../../../src/type/SkippedTestClass.js'

describe('formatSkippedTestClass', () => {
  let messages: Messages<string>

  beforeEach(() => {
    messages = {
      getMessage: vi.fn((key: string, args?: string[]) => {
        const templates: Record<string, string> = {
          'info.testClassNotUsable': `Skipping test class '${args?.[0]}'${args?.[1]}: ${args?.[2]}.`,
          'info.contributedBySuite': `(contributed by test suite ${args?.[0]})`,
          'info.reasonNotFound': 'it could not be found on this org',
          'info.reasonNotAccessible': 'it is not accessible on this org',
          'info.reasonNoCoverage': 'it contributed no covered lines',
        }
        return templates[key] ?? key
      }),
    } as unknown as Messages<string>
  })

  it('Given a not-found skip with no provenance, When formatted, Then the sentence names the class and the reason with no suite clause', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'BadTest',
      reason: 'not-found',
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BadTest': it could not be found on this org."
    )
  })

  it('Given a not-accessible skip, When formatted, Then the reason fragment names the class as inaccessible', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'MyClasTest',
      reason: 'not-accessible',
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'MyClasTest': it is not accessible on this org."
    )
  })

  it('Given a no-coverage skip, When formatted, Then the reason fragment is rendered with no token array', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'BarTest',
      reason: 'no-coverage',
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BarTest': it contributed no covered lines."
    )
    expect(messages.getMessage).toHaveBeenCalledWith('info.reasonNoCoverage')
  })

  it('Given a skip contributed by one suite, When formatted, Then a suite clause is inserted with a leading separator space', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'BadTest',
      reason: 'not-found',
      suiteNames: ['SmokeSuite'],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BadTest' (contributed by test suite 'SmokeSuite'): it could not be found on this org."
    )
  })

  it('Given a skip contributed by two suites, When formatted, Then both are quoted and joined inside a single clause in the given order', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'BarTest',
      reason: 'no-coverage',
      suiteNames: ['SmokeSuite', 'RegressionSuite'],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BarTest' (contributed by test suite 'SmokeSuite', 'RegressionSuite'): it contributed no covered lines."
    )
  })

  it('Given a skip whose suiteNames is an empty array, When formatted, Then no suite clause is rendered', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'BadTest',
      reason: 'not-found',
      suiteNames: [],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BadTest': it could not be found on this org."
    )
  })

  it('Given a suite name carrying control characters, When formatted, Then they are folded to single spaces and the sentence stays on one line', () => {
    // Arrange — suite names come from the org and are not constrained by the
    // class name grammar, unlike className.
    const skipped: SkippedTestClass = {
      className: 'BadTest',
      reason: 'not-found',
      suiteNames: ['Smoke\u0001Suite\u009FA\nB'],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).not.toContain('\n')
    const isControlCharacter = (character: string): boolean => {
      const code = character.charCodeAt(0)
      return code <= 0x1f || (code >= 0x7f && code <= 0x9f)
    }
    expect(Array.from(sut).some(isControlCharacter)).toBe(false)
  })

  it('Given a suite name carrying consecutive control characters, When formatted, Then they fold to a single space rather than one per character', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'BadTest',
      reason: 'not-found',
      suiteNames: ['Smoke\u0001\u0002Suite'],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BadTest' (contributed by test suite 'Smoke Suite'): it could not be found on this org."
    )
  })
})

describe('formatSkippedTestClasses', () => {
  let messages: Messages<string>

  beforeEach(() => {
    messages = {
      getMessage: vi.fn((key: string, args?: string[]) => {
        const templates: Record<string, string> = {
          'info.testClassNotUsable': `Skipping test class '${args?.[0]}'${args?.[1]}: ${args?.[2]}.`,
          'info.contributedBySuite': `(contributed by test suite ${args?.[0]})`,
          'info.reasonNotFound': 'it could not be found on this org',
          'info.reasonNoCoverage': 'it contributed no covered lines',
        }
        return templates[key] ?? key
      }),
    } as unknown as Messages<string>
  })

  it('Given two verdicts, When formatted, Then two sentences are returned in input order', () => {
    // Arrange
    const skipped: SkippedTestClass[] = [
      { className: 'BadTest', reason: 'not-found' },
      { className: 'BarTest', reason: 'no-coverage' },
    ]

    // Act
    const sut = formatSkippedTestClasses(skipped, messages)

    // Assert
    expect(sut).toEqual([
      "Skipping test class 'BadTest': it could not be found on this org.",
      "Skipping test class 'BarTest': it contributed no covered lines.",
    ])
  })

  it('Given an empty verdict list, When formatted, Then an empty array is returned', () => {
    // Arrange
    const skipped: SkippedTestClass[] = []

    // Act
    const sut = formatSkippedTestClasses(skipped, messages)

    // Assert
    expect(sut).toEqual([])
  })
})
