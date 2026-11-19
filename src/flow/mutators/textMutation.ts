import type { Element } from '@xmldom/xmldom'
import type { FlowMutation } from '../types.js'
import type { FlowXmlDom } from '../xml/FlowXmlDom.js'

type MutationLabel = Omit<FlowMutation, 'edits' | 'anchor' | 'replacement'>

// The single-edit mutation almost every mutator produces: the text of one
// leaf element replaced, which is also what the mutant is located by.
export const textMutation = (
  dom: FlowXmlDom,
  element: Element,
  text: string,
  label: MutationLabel
): FlowMutation => {
  const edit = dom.replaceTextEdit(element, text)
  return {
    ...label,
    edits: [edit],
    anchor: { start: edit.start, end: edit.end },
    replacement: edit.replacement,
  }
}

// Flow Builder writes a boolean constant as a reference to a global constant
// as often as a literal: both are booleans to the mutators.
const GLOBAL_CONSTANT_BOOLEAN = /^\$GlobalConstant\.(True|False)$/i

export interface BooleanValue {
  element: Element
  value: 'true' | 'false'
  // The text that holds the opposite value, in the element's own spelling.
  inverted: string
}

// The boolean a `container` below `scope` holds — <booleanValue> or a
// <elementReference> to $GlobalConstant.True/False — or undefined.
export const booleanIn = (
  dom: FlowXmlDom,
  scope: Element,
  container: string
): BooleanValue | undefined => {
  // A text read from an element implies the element: only the text is
  // checked.
  const literal = firstNested(dom, scope, container, 'booleanValue')
  const inverted = invertBoolean(dom.text(literal)?.toLowerCase())
  if (inverted) {
    return {
      element: literal as Element,
      value: invertBoolean(inverted) as 'true' | 'false',
      inverted,
    }
  }
  const reference = firstNested(dom, scope, container, 'elementReference')
  const match = GLOBAL_CONSTANT_BOOLEAN.exec(dom.text(reference) as string)
  if (!match) return undefined
  const isTrue = match[1].toLowerCase() === 'true'
  return {
    element: reference as Element,
    value: isTrue ? 'true' : 'false',
    inverted: `$GlobalConstant.${isTrue ? 'False' : 'True'}`,
  }
}

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
