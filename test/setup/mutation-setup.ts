/*
 * Stryker forces pool:'threads' (worker_threads) which crashes the re2 native
 * addon during module registration. Replace re2 with a RegExp wrapper so the
 * native binary is never loaded during mutation test runs. The public API
 * surface used by production code is `.test(str)` — everything else is a noop.
 */
vi.mock('re2', () => {
  class RE2 {
    private readonly inner: RegExp

    constructor(pattern: string, flags?: string) {
      this.inner = new RegExp(pattern, flags)
    }

    test(str: string): boolean {
      return this.inner.test(str)
    }

    exec(str: string): RegExpExecArray | null {
      return this.inner.exec(str)
    }
  }

  return { default: RE2 }
})
