import type { Element } from '@xmldom/xmldom'
import type { FlowMutation, FlowMutator } from '../types.js'
import type { FlowXmlDom } from '../xml/FlowXmlDom.js'

const BYPASSABLE_TAGS = [
  'subflows',
  'recordCreates',
  'recordUpdates',
  'recordDeletes',
  'assignments',
  'actionCalls',
  'recordLookups',
]

interface RuleConnector {
  rule: Element
  connector: Element
}

// Who points at whom, read once per flow: every element's mutants are then a
// lookup, so the cost of the mutator grows with the flow, not its square.
interface ConnectorIndex {
  referencesTo: Map<string, Element[]>
  ruleConnectorsTo: Map<string, RuleConnector[]>
}

const push = <T>(map: Map<string, T[]>, key: string, value: T): void => {
  const values = map.get(key)
  if (values) values.push(value)
  else map.set(key, [value])
}

// Element names are compared as text in JavaScript, never spliced into a
// query: a name a hand-edited flow spells with a quote is just another name.
const indexConnectors = (dom: FlowXmlDom): ConnectorIndex => {
  const referencesTo = new Map<string, Element[]>()
  for (const reference of dom.elements('targetReference')) {
    push(referencesTo, dom.text(reference) ?? '', reference)
  }
  const ruleConnectorsTo = new Map<string, RuleConnector[]>()
  for (const rule of dom.elements('rules')) {
    for (const connector of dom.children(rule, 'connector')) {
      push(
        ruleConnectorsTo,
        dom.childText(connector, 'targetReference') ?? '',
        {
          rule,
          connector,
        }
      )
    }
  }
  return { referencesTo, ruleConnectorsTo }
}

export class ConnectorBypassMutator implements FlowMutator {
  public readonly name = 'ConnectorBypassMutator'

  public mutate(dom: FlowXmlDom): FlowMutation[] {
    const index = indexConnectors(dom)
    return BYPASSABLE_TAGS.flatMap(tag =>
      dom.elements(tag).flatMap(element => {
        const elementName = dom.childText(element, 'name')
        if (!elementName) return []
        const connector = dom.child(element, 'connector')
        const outgoingTarget =
          connector && dom.childText(connector, 'targetReference')
        return outgoingTarget
          ? this.rewire(dom, index, tag, elementName, outgoingTarget)
          : this.detachTerminal(dom, index, tag, elementName)
      })
    )
  }

  // Points every connector that reaches the element straight at the
  // element's own successor, as one mutant.
  private rewire(
    dom: FlowXmlDom,
    index: ConnectorIndex,
    tag: string,
    elementName: string,
    outgoingTarget: string
  ): FlowMutation[] {
    const incoming = index.referencesTo.get(elementName) ?? []
    if (incoming.length === 0) return []
    return [
      {
        mutatorName: this.name,
        elementName,
        description: `Bypassed ${tag} element '${elementName}' by rewiring incoming connectors directly to '${outgoingTarget}'`,
        edits: incoming.map(reference =>
          dom.replaceTextEdit(reference, outgoingTarget)
        ),
      },
    ]
  }

  // A terminal element has no successor to rewire to: each decision outcome
  // leading to it loses its connector instead, one mutant per outcome.
  private detachTerminal(
    dom: FlowXmlDom,
    index: ConnectorIndex,
    tag: string,
    elementName: string
  ): FlowMutation[] {
    return (index.ruleConnectorsTo.get(elementName) ?? []).map(
      ({ rule, connector }) => ({
        mutatorName: this.name,
        elementName,
        description: `Bypassed terminal ${tag} element '${elementName}' in rule '${dom.childText(rule, 'name') ?? 'Rule'}' by removing connector`,
        edits: [dom.removeElementEdit(connector)],
      })
    )
  }
}
