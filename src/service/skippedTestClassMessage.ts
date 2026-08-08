import { Messages } from '@salesforce/core'
import { SkippedTestClass, UnusableReason } from '../type/SkippedTestClass.js'

const REASON_KEY: Record<UnusableReason, string> = {
  'not-found': 'info.reasonNotFound',
  'not-accessible': 'info.reasonNotAccessible',
  'does-not-compile': 'info.reasonDoesNotCompile',
  'no-coverage': 'info.reasonNoCoverage',
}

const isControlCharacter = (character: string): boolean => {
  const code = character.charCodeAt(0)
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f)
}

// Org-supplied text reaches the terminal here: suite names are unconstrained
// by the class name grammar. A character-class regex would trip a lint rule
// meant to catch accidental control bytes, so this walks the string instead,
// folding each run of control characters to a single space — which is also
// what keeps a newline-joined skip sentence on one line. Class names need no
// folding: they are pinned to the identifier grammar before any org call.
const sanitizeForDisplay = (value: string): string =>
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
