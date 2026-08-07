import { Messages } from '@salesforce/core'
import { SkippedTestClass, UnusableReason } from '../type/SkippedTestClass.js'

const REASON_KEY: Record<UnusableReason, string> = {
  'not-a-test-class': 'info.reasonNotATestClass',
  'not-readable': 'info.reasonNotReadable',
  'no-coverage': 'info.reasonNoCoverage',
}

// The bundle loader trims each section body, so the separator space cannot
// live in info.contributedBySuite — it is applied here, at the render site.
export const formatSkippedTestClass = (
  skipped: SkippedTestClass,
  messages: Messages<string>
): string => {
  const suiteClause = skipped.suiteNames?.length
    ? ` ${messages.getMessage('info.contributedBySuite', [
        skipped.suiteNames.map(name => `'${name}'`).join(', '),
      ])}`
    : ''
  return messages.getMessage('info.testClassNotUsable', [
    skipped.className,
    suiteClause,
    messages.getMessage(REASON_KEY[skipped.reason]),
  ])
}

export const formatSkippedTestClasses = (
  skipped: SkippedTestClass[],
  messages: Messages<string>
): string[] => skipped.map(entry => formatSkippedTestClass(entry, messages))
