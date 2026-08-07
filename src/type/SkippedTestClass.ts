import { TestClassOrigins } from './TestClassOrigin.js'

export type UnusableReason = 'not-found' | 'not-accessible' | 'no-coverage'

export interface SkippedTestClass {
  className: string
  reason: UnusableReason
  suiteNames?: string[]
}

export const attachSuiteProvenance = (
  skipped: SkippedTestClass[],
  origins: TestClassOrigins | undefined
): SkippedTestClass[] =>
  skipped.map(entry => {
    const suiteNames = origins?.get(entry.className.toLowerCase())
    return suiteNames ? { ...entry, suiteNames } : entry
  })

/** Every producer sets `className` to the perimeter entry verbatim, so exact
 *  string membership is the correct join here and `filter` preserves the
 *  user's order. This invariant is why no case folding happens at this
 *  step. */
export const reducePerimeter = (
  perimeter: string[],
  skipped: SkippedTestClass[]
): string[] => {
  const dropped = new Set(skipped.map(entry => entry.className))
  return perimeter.filter(name => !dropped.has(name))
}
