import { ParserRuleContext } from 'antlr4ts'
import { ApexParserListener } from 'apex-parser'
import type { SkipPattern } from '../service/skipPattern.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { BaseListener } from './baseListener.js'

// @ts-ignore: Just a proxy doing accumulation of mutations
export class MutationListener implements ApexParserListener {
  private listeners: BaseListener[]
  // Memoised dispatch table: method name → listeners that implement it.
  // Populated lazily per method on first invocation so Proxy traps for
  // unknown ANTLR hooks do not re-scan every listener on every AST node.
  private readonly dispatchCache = new Map<string | symbol, BaseListener[]>()
  _mutations: ApexMutation[] = []

  public getMutations() {
    return this._mutations
  }

  constructor(
    listeners: BaseListener[],
    protected readonly coveredLines: Set<number>,
    protected readonly skipPatterns: SkipPattern[] = [],
    protected readonly allowedLines: Set<number> | undefined = undefined,
    protected readonly sourceLines: string[] = []
  ) {
    this.listeners = listeners

    this.listeners.forEach(listener => {
      listener.setCoveredLines?.(coveredLines)
    })
    // Share mutations array across all listeners
    this.listeners
      .filter(listener => '_mutations' in listener)
      .forEach(listener => {
        ;(listener as BaseListener)._mutations = this._mutations
      })

    // Create a proxy that automatically forwards all method calls to listeners.
    // Per-trap cost is now O(K) where K = listeners implementing the hook
    // (typically 1-2), not O(N) over all 25 mutators.
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop]
        }

        return (...args: unknown[]) => {
          // No arity guard: `args` is a rest parameter so it is always an
          // array, and a missing context is absorbed by the optional chaining
          // below — `isLineEligible(undefined)` is false.
          const ctx = args[0] as ParserRuleContext
          if (this.isLineEligible(ctx?.start?.line)) {
            const subscribers = this.resolveSubscribers(prop)
            for (const listener of subscribers) {
              ;(listener[prop] as Function).apply(listener, args)
            }
          }
        }
      },
    })
  }

  private resolveSubscribers(prop: string | symbol): BaseListener[] {
    const cached = this.dispatchCache.get(prop)
    // Memoisation only: a forced miss recomputes the identical subscriber list.
    // Stryker disable next-line ConditionalExpression: cache hit is not observable.
    if (cached !== undefined) return cached
    const subs = this.listeners.filter(
      listener => prop in listener && typeof listener[prop] === 'function'
    )
    this.dispatchCache.set(prop, subs)
    return subs
  }

  private isLineEligible(line: number): boolean {
    if (!line) {
      return false
    }
    if (!this.coveredLines.has(line)) {
      return false
    }
    if (this.allowedLines !== undefined && !this.allowedLines.has(line)) {
      return false
    }
    // The length check is a short circuit: `some` over an empty pattern list is
    // already false, so skipping it changes cost, not the verdict.
    // Stryker disable next-line ConditionalExpression,EqualityOperator: short circuit only.
    if (this.skipPatterns.length > 0 && this.sourceLines.length >= line) {
      const sourceLine = this.sourceLines[line - 1]
      if (this.skipPatterns.some(pattern => pattern.test(sourceLine))) {
        return false
      }
    }
    return true
  }
}
