/** Keyed by lower-cased class name — ApexClass.Name matching is
 *  case-insensitive. Values are suite names echoed case-exact in the order
 *  the user named the suites. A class typed via --test-class
 *  has no entry, even when a suite also contains it. */
export type TestClassOrigins = Record<string, string[]>
