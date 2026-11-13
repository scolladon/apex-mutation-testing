import type { Element } from '@xmldom/xmldom'
import type { FlowMutation } from '../types.js'
import type { FlowXmlDom } from '../xml/FlowXmlDom.js'

type MutationLabel = Omit<FlowMutation, 'edits'>

// The single-edit mutation almost every mutator produces: the text of one
// leaf element replaced.
export const textMutation = (
  dom: FlowXmlDom,
  element: Element,
  text: string,
  label: MutationLabel
): FlowMutation => ({ ...label, edits: [dom.replaceTextEdit(element, text)] })

// The first `localName` directly inside any `container` below `scope` —
// e.g. the stringValue of an assignment item's value.
export const firstNested = (
  dom: FlowXmlDom,
  scope: Element,
  container: string,
  localName: string
): Element | undefined =>
  dom
    .elements(container, scope)
    .map(parent => dom.child(parent, localName))
    .find(element => element !== undefined)

export const invertBoolean = (value: string | undefined): string | undefined =>
  value === 'true' ? 'false' : value === 'false' ? 'true' : undefined
