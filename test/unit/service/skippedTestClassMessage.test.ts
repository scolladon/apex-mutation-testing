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
          'info.reasonNotATestClass': 'it is not a test class',
          'info.reasonNotReadable':
            'it could not be found or is not accessible on this org',
          'info.reasonNoCoverage': 'it contributed no covered lines',
        }
        return templates[key] ?? key
      }),
    } as unknown as Messages<string>
  })

  it('Given a not-a-test-class skip with no provenance, When formatted, Then the sentence names the class and the reason with no suite clause', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'BadTest',
      reason: 'not-a-test-class',
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe("Skipping test class 'BadTest': it is not a test class.")
  })

  it('Given a not-readable skip, When formatted, Then the reason fragment names the class as unreadable', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'MyClasTest',
      reason: 'not-readable',
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'MyClasTest': it could not be found or is not accessible on this org."
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
      reason: 'not-a-test-class',
      suiteNames: ['SmokeSuite'],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BadTest' (contributed by test suite 'SmokeSuite'): it is not a test class."
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
      reason: 'not-a-test-class',
      suiteNames: [],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe("Skipping test class 'BadTest': it is not a test class.")
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
          'info.reasonNotATestClass': 'it is not a test class',
          'info.reasonNoCoverage': 'it contributed no covered lines',
        }
        return templates[key] ?? key
      }),
    } as unknown as Messages<string>
  })

  it('Given two verdicts, When formatted, Then two sentences are returned in input order', () => {
    // Arrange
    const skipped: SkippedTestClass[] = [
      { className: 'BadTest', reason: 'not-a-test-class' },
      { className: 'BarTest', reason: 'no-coverage' },
    ]

    // Act
    const sut = formatSkippedTestClasses(skipped, messages)

    // Assert
    expect(sut).toEqual([
      "Skipping test class 'BadTest': it is not a test class.",
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
