import { Messages } from '@salesforce/core'
import {
  attachSuiteProvenance,
  formatSkippedTestClass,
} from '../../../src/service/skippedTestClassMessage.js'
import { SkippedTestClass } from '../../../src/type/SkippedTestClass.js'
import { TestClassOrigins } from '../../../src/type/TestClassOrigin.js'

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

describe('attachSuiteProvenance', () => {
  it('Given verdicts and undefined origins, When attached, Then every entry is returned unchanged', () => {
    // Arrange
    const skipped: SkippedTestClass[] = [
      { className: 'BadTest', reason: 'not-a-test-class' },
    ]

    // Act
    const sut = attachSuiteProvenance(skipped, undefined)

    // Assert
    expect(sut).toEqual(skipped)
  })

  it('Given origins keyed lower-case and a verdict class differing only in case, When attached, Then the suite names are attached', () => {
    // Arrange
    const skipped: SkippedTestClass[] = [
      { className: 'BadTest', reason: 'not-a-test-class' },
    ]
    const origins: TestClassOrigins = { badtest: ['SmokeSuite'] }

    // Act
    const sut = attachSuiteProvenance(skipped, origins)

    // Assert
    expect(sut[0]?.suiteNames).toEqual(['SmokeSuite'])
  })

  it('Given origins with no entry for the verdict class, When attached, Then that entry has no suiteNames field', () => {
    // Arrange
    const skipped: SkippedTestClass[] = [
      { className: 'BadTest', reason: 'not-a-test-class' },
    ]
    const origins: TestClassOrigins = { othertest: ['SmokeSuite'] }

    // Act
    const sut = attachSuiteProvenance(skipped, origins)

    // Assert
    expect(sut[0]).not.toHaveProperty('suiteNames')
  })

  it('Given an input array of verdicts, When attached, Then neither the array nor its entries are mutated', () => {
    // Arrange
    const skipped: SkippedTestClass[] = [
      { className: 'BadTest', reason: 'not-a-test-class' },
    ]
    const origins: TestClassOrigins = { badtest: ['SmokeSuite'] }
    const originalEntry = skipped[0]

    // Act
    const sut = attachSuiteProvenance(skipped, origins)

    // Assert
    expect(sut).not.toBe(skipped)
    expect(skipped[0]).toBe(originalEntry)
    expect(skipped[0]).not.toHaveProperty('suiteNames')
  })
})
