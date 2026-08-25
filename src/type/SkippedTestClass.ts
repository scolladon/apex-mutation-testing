import { TestClassOrigins } from './TestClassOrigin.js'

export type UnusableReason =
  | 'not-found'
  | 'not-accessible'
  | 'not-qualified'
  | 'does-not-compile'
  | 'no-coverage'

type SkippedTestClassBase = {
  className: string
  suiteNames?: string[]
}

export type SkippedTestClass =
  | (SkippedTestClassBase & {
      reason: Exclude<UnusableReason, 'does-not-compile'>
    })
  | (SkippedTestClassBase & { reason: 'does-not-compile'; detail: string })

export const attachSuiteProvenance = (
  skipped: SkippedTestClass[],
  origins: TestClassOrigins | undefined
): SkippedTestClass[] =>
  skipped.map((entry): SkippedTestClass => {
    const suiteNames = origins?.get(entry.className.toLowerCase())
    return suiteNames ? { ...entry, suiteNames } : entry
  })

/** Every producer sets `className` to the perimeter entry verbatim, so exact
 *  string membership is the correct join here and `filter` preserves the
 *  user's order. This invariant is still true and now load-bearing for a
 *  different reason: producers resolve the Id side outward through a
 *  `TestClassResolutions` map to decide *whether* a class is skipped, but
 *  they never resolve the *emitted* name — `className` always stays the
 *  perimeter entry's own spelling, which is what this join compares against.
 *  That is why no case folding happens at this step. */
export const reducePerimeter = (
  perimeter: string[],
  skipped: SkippedTestClass[]
): string[] => {
  const dropped = new Set(skipped.map(entry => entry.className))
  return perimeter.filter(name => !dropped.has(name))
}
