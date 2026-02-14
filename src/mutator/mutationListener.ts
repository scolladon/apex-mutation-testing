import { ParserRuleContext } from 'antlr4ts'
import { ApexParserListener } from 'apex-parser'
import { SObjectDescribeRepository } from '../adapter/sObjectDescribeRepository.js'
import { ApexMethod } from '../type/ApexMethod.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { BaseListener } from './baseListener.js'
import { ReturnTypeAwareBaseListener } from './returnTypeAwareBaseListener.js'

// @ts-ignore: Just a proxy doing accumulation of mutations
export class MutationListener implements ApexParserListener {
  private listeners: BaseListener[]
  _mutations: ApexMutation[] = []

  // Methods that should always be called regardless of covered lines
  // These are needed for tracking method context in type-aware mutators
  private static readonly ALWAYS_FORWARD_METHODS = new Set([
    'enterMethodDeclaration',
    'exitMethodDeclaration',
    'enterLocalVariableDeclaration',
    'enterFormalParameter',
    'enterFieldDeclaration',
    'enterEnhancedForControl',
  ])

  public getMutations() {
    return this._mutations
  }

  constructor(
    listeners: BaseListener[],
    protected readonly coveredLines: Set<number>,
    protected readonly typeTable?: Map<string, ApexMethod>,
    sObjectDescribeRepository?: SObjectDescribeRepository
  ) {
    this.listeners = listeners

    if (typeTable) {
      this.listeners.forEach(listener => {
        if (listener instanceof ReturnTypeAwareBaseListener) {
          listener.setTypeTable(typeTable)
        }
      })
    }
    if (sObjectDescribeRepository) {
      this.listeners.forEach(listener => {
        listener.setSObjectDescribeRepository(sObjectDescribeRepository)
      })
    }
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
            const shouldForward =
              MutationListener.ALWAYS_FORWARD_METHODS.has(prop as string) ||
              this.coveredLines.has(ctx?.start?.line)

            if (shouldForward) {
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
