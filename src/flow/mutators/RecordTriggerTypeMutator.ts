import type { FlowMutation, FlowMutator } from '../types.js'
import type { FlowXmlDom } from '../xml/FlowXmlDom.js'
import { textMutation } from './textMutation.js'

const TRIGGER_REPLACEMENTS = new Map<string, string[]>([
  ['Create', ['Update']],
  ['Update', ['Create']],
  ['CreateAndUpdate', ['Create', 'Update']],
])

export class RecordTriggerTypeMutator implements FlowMutator {
  public readonly name = 'RecordTriggerTypeMutator'

  public mutate(dom: FlowXmlDom): FlowMutation[] {
    const start = dom.child(dom.root, 'start')
    const trigger = start && dom.child(start, 'recordTriggerType')
    const original = dom.text(trigger)
    if (!trigger || !original) {
      return []
    }
    return (TRIGGER_REPLACEMENTS.get(original) ?? []).map(replacement =>
      textMutation(dom, trigger, replacement, {
        mutatorName: this.name,
        elementName: '$Start',
        description: `Changed recordTriggerType from '${original}' to '${replacement}'`,
      })
    )
  }
}
