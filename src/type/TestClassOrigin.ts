/** Keyed by lower-cased class name — ApexClass.Name matching is
 *  case-insensitive. Values are suite names echoed case-exact in the order
 *  the user named the suites. A class typed via --test-class
 *  has no entry, even when a suite also contains it.
 *
 *  A `ReadonlyMap`, not a `Record`: a plain object indexed by an arbitrary
 *  class name reaches into `Object.prototype`. A perimeter class named
 *  `Constructor` folds to the key `constructor`, and a `Record` lookup on
 *  that key returns `Object.prototype.constructor` — a function, not
 *  `undefined` — silently corrupting the result instead of reporting "no
 *  origin".
 *
 *  No suite can contribute the same class twice: suite names are deduped
 *  case-sensitively before a suite's members are ever read, so each key's
 *  accumulated suite list never repeats an entry. */
export type TestClassOrigins = ReadonlyMap<string, string[]>
