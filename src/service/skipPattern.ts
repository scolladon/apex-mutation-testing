import { RE2JS } from 're2js'

// Port: the abstraction the rest of the code depends on.
export interface SkipPattern {
  // True when `line` contains a match anywhere (substring semantics — pins re2 `.test()`).
  test(line: string): boolean
}

// Adapter: re2js-backed. Compile throws the raw engine error on an invalid pattern;
// callers own the user-facing wrap (keeps the port domain-agnostic).
export const compileSkipPattern = (pattern: string): SkipPattern => {
  const compiled = RE2JS.compile(pattern)
  return {
    test: (line: string) => compiled.matcher(line).find(),
  }
}
