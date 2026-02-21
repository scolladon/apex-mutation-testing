import { ParserRuleContext } from 'antlr4ts'
import { ApexParserListener } from 'apex-parser'
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
    protected readonly coveredLines: Set<number>
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
            if (this.coveredLines.has(ctx?.start?.line)) {
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
}
