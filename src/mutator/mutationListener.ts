import { ParserRuleContext } from 'antlr4ts'
import { ApexParserListener } from 'apex-parser'
import type { RE2Instance } from '../service/configReader.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { BaseListener } from './baseListener.js'

// @ts-ignore: Just a proxy doing accumulation of mutations
export class MutationListener implements ApexParserListener {
  private listeners: BaseListener[]
  _mutations: ApexMutation[] = []

  public getMutations() {
    return this._mutations
  }

  constructor(
    listeners: BaseListener[],
    protected readonly coveredLines: Set<number>,
    protected readonly skipPatterns: RE2Instance[] = [],
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

    // Create a proxy that automatically forwards all method calls to listeners
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop]
        }

        // Return a function that calls the method on all listeners that have it
        return (...args: unknown[]) => {
          if (Array.isArray(args) && args.length > 0) {
            const ctx = args[0] as ParserRuleContext
            if (this.isLineEligible(ctx?.start?.line)) {
              this.listeners.forEach(listener => {
                if (prop in listener && typeof listener[prop] === 'function') {
                  ;(listener[prop] as Function).apply(listener, args)
                }
              })
            }
          }
        }
      },
    })
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
    if (this.skipPatterns.length > 0 && this.sourceLines.length >= line) {
      const sourceLine = this.sourceLines[line - 1]
      if (this.skipPatterns.some(pattern => pattern.test(sourceLine))) {
        return false
      }
    }
    return true
  }
}
