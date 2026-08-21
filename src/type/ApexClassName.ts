const SEPARATOR = '.'
const QUALIFIED_SEGMENT_COUNT = 2
const NAMESPACE_SEGMENT = 0
const NAME_SEGMENT = 1

export interface ApexClassRef {
  namespace: string | null
  name: string
}

// The grammar admits at most one separator, so `split` partitions exactly
// into one or two segments and no index arithmetic is needed. `indexOf` /
// `lastIndexOf` would compute identically for every representable input —
// the same equivalent-mutant shape TestMethodId.ts avoids for the same
// reason — and this repo cannot suppress an unkillable mutant.
export const splitApexClassName = (spelling: string): ApexClassRef => {
  const segments = spelling.split(SEPARATOR)
  return segments.length === QUALIFIED_SEGMENT_COUNT
    ? { namespace: segments[NAMESPACE_SEGMENT], name: segments[NAME_SEGMENT] }
    : { namespace: null, name: spelling }
}

export const bareApexClassName = (spelling: string): string =>
  splitApexClassName(spelling).name
