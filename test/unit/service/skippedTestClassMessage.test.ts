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
          'info.reasonNotQualified':
            'it is accessible on this org only under a qualified spelling — re-run naming the qualified spelling',
          'info.reasonNoCoverage': 'it contributed no covered lines',
          'info.reasonDoesNotCompile': `it does not compile${args?.[0] ?? ''}`,
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

  it('Given a not-qualified skip, When formatted, Then the reason fragment points the caller at the qualified spelling', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'ArgumentTest',
      reason: 'not-qualified',
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'ArgumentTest': it is accessible on this org only under a qualified spelling — re-run naming the qualified spelling."
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

  it('Given a does-not-compile skip carrying a detail, When formatted, Then the detail renders as a parenthetical after the reason', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'AmtProbeDepTest',
      reason: 'does-not-compile',
      detail: 'Invalid type: AmtProbeDep at line 3 column 5',
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'AmtProbeDepTest': it does not compile (Invalid type: AmtProbeDep at line 3 column 5)."
    )
  })

  it('Given a does-not-compile skip with a blank detail, When formatted, Then no parenthetical is rendered', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'X',
      reason: 'does-not-compile',
      detail: '',
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe("Skipping test class 'X': it does not compile.")
  })

  it('Given a does-not-compile detail carrying newlines and control characters, When formatted, Then it is folded to a single space and the sentence stays on one line', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'BrokenTest',
      reason: 'does-not-compile',
      detail: 'line 3\ncolumn 5: Variable does not exist',
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BrokenTest': it does not compile (line 3 column 5: Variable does not exist)."
    )
  })

  it('Given a does-not-compile skip contributed by a suite, When formatted, Then both the suite clause and the detail render', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'BrokenTest',
      reason: 'does-not-compile',
      detail: 'Invalid type: Dep',
      suiteNames: ['SmokeSuite'],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BrokenTest' (contributed by test suite 'SmokeSuite'): it does not compile (Invalid type: Dep)."
    )
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
    // Arrange — suite names are user-typed and not constrained by the class
    // name grammar the way className is, but are sanitized the same way as
    // defense in depth.
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

  it('Given a suite name carrying a leading unit separator (0x1F) and a trailing DEL (0x7F), When formatted, Then both boundary characters are folded and trimmed away', () => {
    // Arrange — closes three mutants at once: `code <= 0x1f` → `< 0x1f` would
    // leave the leading 0x1F untouched, `code >= 0x7f` → `> 0x7f` would leave
    // the trailing 0x7F untouched, and deleting `.trim()` would leave the
    // fold-induced spaces at both ends.
    const skipped: SkippedTestClass = {
      className: 'BadTest',
      reason: 'not-found',
      suiteNames: ['\u001FSmokeSuite\u007F'],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BadTest' (contributed by test suite 'SmokeSuite'): it could not be found on this org."
    )
  })

  it('Given a suite name carrying a line separator and a paragraph separator, When formatted, Then both are folded to spaces and the sentence stays on one line', () => {
    // Arrange — U+2028/U+2029 are not covered by the C0/C1/DEL ranges.
    const skipped: SkippedTestClass = {
      className: 'BadTest',
      reason: 'not-found',
      suiteNames: ['Smoke\u2028Suite\u2029A'],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BadTest' (contributed by test suite 'Smoke Suite A'): it could not be found on this org."
    )
  })

  it('Given a suite name carrying bidi override and isolate control characters, When formatted, Then they are folded to spaces', () => {
    // Arrange — U+202E (RIGHT-TO-LEFT OVERRIDE) and U+2066 (LEFT-TO-RIGHT
    // ISOLATE) can otherwise reorder the rendered sentence visually
    // (Trojan-Source style).
    const skipped: SkippedTestClass = {
      className: 'BadTest',
      reason: 'not-found',
      suiteNames: ['Smoke\u202ESuite\u2066A'],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BadTest' (contributed by test suite 'Smoke Suite A'): it could not be found on this org."
    )
  })

  it('Given a suite name carrying the remaining invisible bidi and joiner characters, When formatted, Then they are folded to spaces', () => {
    // Arrange — U+061C (ARABIC LETTER MARK) is the one Unicode bidi control
    // outside the U+200E..U+2069 span, and U+2060 (WORD JOINER) is the
    // non-deprecated twin of U+FEFF. Both render invisibly.
    const skipped: SkippedTestClass = {
      className: 'BadTest',
      reason: 'not-found',
      suiteNames: ['Smoke؜Suite⁠A'],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BadTest' (contributed by test suite 'Smoke Suite A'): it could not be found on this org."
    )
  })

  it('Given a suite name carrying zero-width characters, When formatted, Then they are folded to spaces', () => {
    // Arrange — U+200B (ZERO WIDTH SPACE) and U+FEFF (BOM) render invisibly
    // but are not whitespace, so `.trim()` alone would not remove them.
    const skipped: SkippedTestClass = {
      className: 'BadTest',
      reason: 'not-found',
      suiteNames: ['Smoke\u200BSuite\uFEFFA'],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BadTest' (contributed by test suite 'Smoke Suite A'): it could not be found on this org."
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
