import { Messages } from '@salesforce/core'
import { SkippedTestClass, UnusableReason } from '../type/SkippedTestClass.js'

const REASON_KEY: Record<UnusableReason, string> = {
  'not-found': 'info.reasonNotFound',
  'not-accessible': 'info.reasonNotAccessible',
  'not-qualified': 'info.reasonNotQualified',
  'does-not-compile': 'info.reasonDoesNotCompile',
  'no-coverage': 'info.reasonNoCoverage',
}

// Each pair is an inclusive [start, end] code point range folded by
// isControlCharacter: C0 controls + DEL/C1, the Arabic letter mark, zero-width
// characters (space, joiners, LRM/RLM), line/paragraph separators, bidi
// embedding/override controls, the word joiner through the bidi isolate
// controls, and the zero-width no-break space (BOM). Together these cover
// every Unicode bidi control, so a suite name cannot visually reorder the
// sentence around it.
const CONTROL_CHARACTER_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x061c, 0x061c],
  [0x200b, 0x200f],
  [0x2028, 0x2029],
  [0x202a, 0x202e],
  [0x2060, 0x2069],
  [0xfeff, 0xfeff],
]

const isControlCharacter = (character: string): boolean => {
  const code = character.charCodeAt(0)
  return CONTROL_CHARACTER_RANGES.some(
    ([start, end]) => code >= start && code <= end
  )
}

// The compile diagnosis is the genuinely org-supplied text reaching the
// terminal here — the platform's own line/column diagnostics, unconstrained
// by any grammar. Suite names are user-typed (the requested suite name the
// CLI/config passes through, not the org's `member.suiteName` — see
// testSuiteResolver.expandSuites) but are sanitized the same way as defense
// in depth. A character-class regex would trip a lint rule meant to catch
// accidental control bytes, so this walks the string instead, folding each
// run of control characters (including line/paragraph separators, bidi
// controls and zero-width characters, which could otherwise break a
// newline-joined sentence onto multiple lines or reorder it visually) to a
// single space. Class names need no folding: they are pinned to the
// identifier grammar before any org call.
export const sanitizeForDisplay = (value: string): string =>
  Array.from(value)
    .reduce((folded, character) => {
      if (!isControlCharacter(character)) {
        return folded + character
      }
      return folded.endsWith(' ') ? folded : `${folded} `
    }, '')
    .trim()

// The bundle loader trims each section body, so the separator space cannot
// live in info.contributedBySuite — it is applied here, at the render site.
const suiteClause = (
  suiteNames: string[] | undefined,
  messages: Messages<string>
): string => {
  if (!suiteNames?.length) {
    return ''
  }
  const quotedNames = suiteNames
    .map(name => `'${sanitizeForDisplay(name)}'`)
    .join(', ')
  return ` ${messages.getMessage('info.contributedBySuite', [quotedNames])}`
}

// A compile diagnosis carries newlines and is the only fragment that takes a
// token; every other reason fragment is specifier-free. A blank detail
// renders no parenthetical rather than an empty pair of parentheses.
const detailClause = (detail: string): string => {
  const sanitized = sanitizeForDisplay(detail)
  return sanitized === '' ? '' : ` (${sanitized})`
}

const renderReason = (
  skipped: SkippedTestClass,
  messages: Messages<string>
): string =>
  skipped.reason === 'does-not-compile'
    ? messages.getMessage(REASON_KEY[skipped.reason], [
        detailClause(skipped.detail),
      ])
    : messages.getMessage(REASON_KEY[skipped.reason])

export const formatSkippedTestClass = (
  skipped: SkippedTestClass,
  messages: Messages<string>
): string =>
  messages.getMessage('info.testClassNotUsable', [
    skipped.className,
    suiteClause(skipped.suiteNames, messages),
    renderReason(skipped, messages),
  ])

export const formatSkippedTestClasses = (
  skipped: SkippedTestClass[],
  messages: Messages<string>
): string[] => skipped.map(entry => formatSkippedTestClass(entry, messages))
