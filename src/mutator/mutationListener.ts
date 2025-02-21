import { BaseListener } from './baseListener.js'

import { ApexParserListener } from 'apex-parser'

// @ts-ignore: Just a proxy doing accumulation of mutations
export class MutationListener implements ApexParserListener {
  private listeners: BaseListener[]
  _mutations: any[] = []

  public getMutations() {
    return this._mutations
  }

  constructor(listeners: BaseListener[]) {
    this.listeners = listeners
    // Share mutations array across all listeners
    this.listeners
      .filter(listener => '_mutations' in listener)
      .forEach(listener => {
        ;(listener as any)._mutations = this._mutations
      })

    // Create a proxy that automatically forwards all method calls to listeners
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop]
        }

        // Return a function that calls the method on all listeners that have it
        return (...args: any[]) => {
          this.listeners.forEach(listener => {
            if (prop in listener && typeof listener[prop] === 'function') {
              ;(listener[prop] as Function).apply(listener, args)
            }
          })
        }
      },
    })
  }
}
