// The single place that knows how a value becomes SOQL query text.
//
// Two characters, and only two, can alter a query from inside a single-quoted
// literal: a quote closes it, and a backslash escapes whatever follows —
// including the closing quote, which lets the literal run on into the rest of
// the WHERE clause. Every other byte is inert.
//
// This module exists because the two builders this adapter layer hands values
// to do NOT both handle those two characters:
//   - jsforce's soql-builder escapes quotes and leaves backslashes raw;
//   - @salesforce/apex-node's test-suite helper escapes nothing at all.
// Until now the only thing keeping a hostile name away from them was
// APEX_CLASS_NAME_PATTERN in ConfigReader — a service-layer regex four modules
// upstream, documented in prose and enforced by nothing at the sink. That made
// query-text integrity a property of a comment. It is now a property of the
// code that builds the query.

const BACKSLASH = /\\/g
const QUOTE = /'/g

// Doubling backslashes BEFORE escaping quotes is load-bearing, not stylistic:
// the reverse order would let a payload's own trailing backslash escape the
// backslash this function just added in front of the closing quote.
export const escapeSoqlLiteral = (value: string): string =>
  value.replace(BACKSLASH, '\\\\').replace(QUOTE, "\\'")

export const toSoqlLiteralList = (values: string[]): string =>
  values.map(value => `'${escapeSoqlLiteral(value)}'`).join(', ')

// Characters this adapter refuses to hand to a builder whose escaping it does
// not own. Named individually so the thrown message can say which one was
// seen without echoing the value itself.
const UNSAFE_CHARACTERS: ReadonlyArray<readonly [string, string]> = [
  ['\\', 'a backslash'],
  ["'", 'a quote'],
]

// Fail-closed guard for the jsforce `.find({ Field: value })` sinks, whose
// literal builder we cannot correct from here. No reachable input reaches this
// throw today — ConfigReader rejects both characters long before — which is
// exactly the point: if that upstream grammar is ever widened, the query stops
// being built rather than being built wrong.
//
// Deliberately not localised, and deliberately does not quote the offending
// value. This is an invariant breach, not a user mistake: the message is for
// whoever widened the grammar, and echoing attacker-shaped text into CLI
// output would turn the guard into an output sink of its own. Matches the
// plain-Error precedent already set by this repository's PollTimeoutError and
// its pollOptions constructor checks.
export const assertSoqlLiteralSafe = (value: string): string => {
  for (const [character, description] of UNSAFE_CHARACTERS) {
    if (value.includes(character)) {
      throw new Error(
        `Refusing to build a SOQL predicate from a name containing ${description}: the query builder for this sink does not escape it.`
      )
    }
  }
  return value
}
