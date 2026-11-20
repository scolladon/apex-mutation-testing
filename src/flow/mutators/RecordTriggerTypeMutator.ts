import type { Element } from '@xmldom/xmldom'
import type { FlowMutation, FlowMutator } from '../types.js'
import type { FlowXmlDom } from '../xml/FlowXmlDom.js'
import { textMutation } from './textMutation.js'

const CREATE = 'Create'

const TRIGGER_REPLACEMENTS = new Map<string, string[]>([
  [CREATE, ['Update']],
  ['Update', [CREATE]],
  ['CreateAndUpdate', [CREATE, 'Update']],
])

// The org refuses to save a flow triggered on Create that uses IsChanged
// (checked on a sandbox; $Record__Prior and
// doesRequireRecordChangedToMeetCriteria are accepted), so that mutant would
// only ever be a CompileError.
const usesIsChanged = (dom: FlowXmlDom): boolean =>
  dom.elements('operator').some(operator => dom.text(operator) === 'IsChanged')

export class RecordTriggerTypeMutator implements FlowMutator {
  public readonly name = 'RecordTriggerTypeMutator'

  public mutate(dom: FlowXmlDom): FlowMutation[] {
    const start = dom.child(dom.root, 'start')
    const trigger = start && dom.child(start, 'recordTriggerType')
    // No trigger, or no text, has no replacement.
    const original = dom.text(trigger) as string
    return (TRIGGER_REPLACEMENTS.get(original) ?? [])
      .filter(replacement => replacement !== CREATE || !usesIsChanged(dom))
      .map(replacement =>
        textMutation(dom, trigger as Element, replacement, {
          mutatorName: this.name,
          elementName: '$Start',
          description: `Changed recordTriggerType from '${original}' to '${replacement}'`,
        })
      )
  }
}
