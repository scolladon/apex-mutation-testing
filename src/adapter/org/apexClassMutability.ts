import { isOwnNamespace } from './orgTypeNames.js'

export interface ApexClassCandidate {
  NamespacePrefix: string | null
  ManageableState: string | null
}

// Allowlist, not a denylist: any state Salesforce introduces later reads as
// not-mutable and refuses cleanly instead of failing mid-campaign with a
// mutant already written. The mutable states are "source this org owns" —
// unmanaged/beta/released/deprecated are packaging-org lifecycle states,
// installedEditable/deprecatedEditable are someone else's unlocked package
// (editable by design); only `installed` — a managed package — is closed.
const MUTABLE_MANAGEABLE_STATES = new Set([
  'unmanaged',
  'installedEditable',
  'beta',
  'released',
  'deprecated',
  'deprecatedEditable',
]) as ReadonlySet<string | null>

// `null` is not a member of the set, so an absent state answers false with no
// null-guard branch; a genuinely missing field arrives as `undefined`, which
// Set.prototype.has also answers false for. Compared exactly, not
// case-folded: ManageableState arrives from one field on one sObject, and
// every spelling above was read back verbatim from a live org.
export const isMutableApexClass = (row: {
  ManageableState: string | null
}): boolean => MUTABLE_MANAGEABLE_STATES.has(row.ManageableState)

export type TargetClassSelection<T> =
  | { kind: 'mutable'; candidate: T }
  | { kind: 'not-mutable'; candidates: T[] } // every matching row; all are non-mutable
  | { kind: 'ambiguous'; candidates: T[] } // the competing MUTABLE rows, for the message
  | { kind: 'not-found' }

// Name-free by construction: both the not-mutable and ambiguous messages are
// rendered by the caller, which has the name and the rows.
export const selectMutableClass = <T extends ApexClassCandidate>(
  candidates: readonly T[],
  orgNamespace: string | null
): TargetClassSelection<T> => {
  if (candidates.length === 0) {
    return { kind: 'not-found' }
  }
  const mutable = candidates.filter(isMutableApexClass)
  if (mutable.length === 0) {
    return { kind: 'not-mutable', candidates: [...candidates] }
  }
  // `find`, not a count check: "exactly one own-namespace candidate" would
  // introduce a more-than-one-own branch that is unreachable (a bare name is
  // unique within a namespace), and an uncoverable branch fails the 100%
  // gate outright.
  const own = mutable.find(candidate =>
    isOwnNamespace(candidate.NamespacePrefix, orgNamespace)
  )
  if (own !== undefined) {
    return { kind: 'mutable', candidate: own }
  }
  if (mutable.length === 1) {
    return { kind: 'mutable', candidate: mutable[0] }
  }
  return { kind: 'ambiguous', candidates: mutable }
}
