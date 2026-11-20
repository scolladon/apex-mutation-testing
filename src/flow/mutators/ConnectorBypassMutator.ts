import type { Element } from '@xmldom/xmldom'
import { analyzeFlowPaths } from '../flowPaths.js'
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

// The connectors a terminal element can lose so that the flow simply ends
// before it: an element's own connector, a decision outcome or default
// outcome, a loop's exit. Never the start's (the flow would do nothing), a
// loop's next-value connector (the loop would never iterate) nor a fault
// connector (that is error handling, not the element's path).
const DETACHABLE_CONNECTORS = new Set([
  'connector',
  'defaultConnector',
  'noMoreValuesConnector',
])
const UNDETACHABLE_OWNERS = new Set(['start', 'scheduledPaths'])

// One connector leading to an element: its <targetReference>, the connector
// holding it, and the element (or decision outcome) the connector leaves.
interface Incoming {
  reference: Element
  connector: Element
  owner: Element
}

// Who points at whom, read once per flow: every element's mutants are then a
// lookup, so the cost of the mutator grows with the flow, not its square.
// Element names are compared as text in JavaScript, never spliced into a
// query: a name a hand-edited flow spells with a quote is just another name.
const indexIncoming = (dom: FlowXmlDom): Map<string, Incoming[]> => {
  const incoming = new Map<string, Incoming[]>()
  for (const reference of dom.elements('targetReference')) {
    const target = dom.text(reference)
    if (target === undefined) continue
    const connector = reference.parentNode as Element
    const entry = {
      reference,
      connector,
      owner: connector.parentNode as Element,
    }
    const entries = incoming.get(target)
    if (entries) entries.push(entry)
    else incoming.set(target, [entry])
  }
  return incoming
}

export class ConnectorBypassMutator implements FlowMutator {
  public readonly name = 'ConnectorBypassMutator'

  public mutate(dom: FlowXmlDom): FlowMutation[] {
    const incoming = indexIncoming(dom)
    const { asyncOnlyElements } = analyzeFlowPaths(dom)
    return BYPASSABLE_TAGS.flatMap(tag =>
      dom.elements(tag).flatMap(element => {
        // A nameless element has no connector leading to it (references
        // with no text are not indexed), so it yields no mutant.
        const elementName = dom.childText(element, 'name') as string
        const connector = dom.child(element, 'connector')
        const outgoingTarget =
          connector && dom.childText(connector, 'targetReference')
        const bypassed = {
          tag,
          elementName,
          anchor: dom.spanOf(element),
          incoming: incoming.get(elementName) ?? [],
        }
        return outgoingTarget
          ? this.rewire(dom, bypassed, outgoingTarget)
          : this.detachTerminal(dom, bypassed, asyncOnlyElements)
      })
    )
  }

  // Points every connector that reaches the element straight at the
  // element's own successor, as one mutant.
  private rewire(
    dom: FlowXmlDom,
    { tag, elementName, anchor, incoming }: Bypassed,
    outgoingTarget: string
  ): FlowMutation[] {
    if (incoming.length === 0) return []
    return [
      {
        mutatorName: this.name,
        elementName,
        description: `Bypassed ${tag} element '${elementName}' by rewiring incoming connectors directly to '${outgoingTarget}'`,
        edits: incoming.map(({ reference }) =>
          dom.replaceTextEdit(reference, outgoingTarget)
        ),
        anchor,
        replacement: '',
      },
    ]
  }

  // A terminal element has no successor to rewire to: each connector leading
  // to it is removed instead, one mutant per connector, so the flow ends
  // where it would have reached the element.
  // A connector leaving an element only the Async Path reaches is skipped:
  // no FlowTest runs it, so removing it could never be detected.
  private detachTerminal(
    dom: FlowXmlDom,
    { tag, elementName, anchor, incoming }: Bypassed,
    asyncOnlyElements: Set<string>
  ): FlowMutation[] {
    return incoming
      .filter(
        ({ connector, owner }) =>
          DETACHABLE_CONNECTORS.has(connector.localName as string) &&
          !UNDETACHABLE_OWNERS.has(owner.localName as string) &&
          !asyncOnlyElements.has(elementNameOf(dom, owner))
      )
      .map(({ connector, owner }) => ({
        mutatorName: this.name,
        elementName,
        description: `Bypassed terminal ${tag} element '${elementName}' by removing ${describeConnector(dom, connector, owner)}`,
        edits: [dom.removeElementEdit(connector)],
        anchor,
        replacement: '',
      }))
  }
}

interface Bypassed {
  tag: string
  elementName: string
  anchor: { start: number; end: number }
  incoming: Incoming[]
}

// The flow element a connector leaves: the decision for a rule's. A nameless
// one is never async-only, which its missing name already says.
const elementNameOf = (dom: FlowXmlDom, owner: Element): string =>
  dom.childText(
    owner.localName === 'rules' ? (owner.parentNode as Element) : owner,
    'name'
  ) as string

const describeConnector = (
  dom: FlowXmlDom,
  connector: Element,
  owner: Element
): string => {
  const ownerName = dom.childText(owner, 'name') ?? owner.localName
  if (owner.localName === 'rules') {
    const decision = owner.parentNode as Element
    return `the connector of rule '${ownerName}' in decision '${dom.childText(decision, 'name') ?? decision.localName}'`
  }
  if (connector.localName === 'defaultConnector') {
    return `the default outcome of '${ownerName}'`
  }
  if (connector.localName === 'noMoreValuesConnector') {
    return `the exit of loop '${ownerName}'`
  }
  return `the connector from '${ownerName}'`
}
