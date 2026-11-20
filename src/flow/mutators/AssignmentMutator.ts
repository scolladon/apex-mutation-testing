import type { Element } from '@xmldom/xmldom'
import type { FlowMutation, FlowMutator } from '../types.js'
import type { FlowXmlDom } from '../xml/FlowXmlDom.js'
import { booleanIn, firstNested, textMutation } from './textMutation.js'

const OPERATOR_SWAPS = new Map<string, string>([
  ['Add', 'Subtract'],
  ['Subtract', 'Add'],
])

// Data types an Add appends to rather than sums: swapping it for Subtract
// gives a flow the org refuses to save.
const TEXT_TYPES = new Set(['String', 'Picklist', 'Multipicklist'])

interface ItemContext {
  dom: FlowXmlDom
  item: Element
  assignmentName: string
  targetReference: string
}

// The resources a flow declares with a data type, by name: a variable, a
// constant, a formula.
const TYPED_RESOURCES = ['variables', 'constants', 'formulas']

// A resource that is text or a collection: Add appends to or with it.
const isTextOrCollection = (dom: FlowXmlDom, resource: Element | undefined) =>
  resource !== undefined &&
  (TEXT_TYPES.has(dom.childText(resource, 'dataType') as string) ||
    dom.childText(resource, 'isCollection') === 'true')

export class AssignmentMutator implements FlowMutator {
  public readonly name = 'AssignmentMutator'

  public mutate(dom: FlowXmlDom): FlowMutation[] {
    const resources = new Map<string | undefined, Element>(
      TYPED_RESOURCES.flatMap(tag => dom.elements(tag))
        .map(resource => [dom.childText(resource, 'name'), resource] as const)
        .filter(([name]) => name !== undefined)
    )
    return dom.elements('assignments').flatMap((assignment, index) => {
      const assignmentName =
        dom.childText(assignment, 'name') ?? `Assignment_${index}`
      return dom
        .elements('assignmentItems', assignment)
        .flatMap((item, itemIndex) => {
          const context: ItemContext = {
            dom,
            item,
            assignmentName,
            targetReference:
              dom.childText(item, 'assignToReference') ?? `Item_${itemIndex}`,
          }
          return [
            this.mutateString(context),
            this.mutateBoolean(context),
            this.mutateNumber(context),
            this.mutateOperator(context, resources),
          ].filter(
            (mutation): mutation is FlowMutation => mutation !== undefined
          )
        })
    })
  }

  private mutateString(context: ItemContext): FlowMutation | undefined {
    const { dom, item, assignmentName, targetReference } = context
    const stringValue = firstNested(dom, item, 'value', 'stringValue')
    if (!stringValue) return undefined
    // an element's textContent is never null, only empty
    const current = stringValue.textContent as string
    const mutated = current === '' ? 'MUTATED' : ''
    return textMutation(dom, stringValue, mutated, {
      mutatorName: this.name,
      elementName: assignmentName,
      description: `Changed assignment '${targetReference}' in '${assignmentName}' from '${current}' to '${mutated}'`,
    })
  }

  private mutateBoolean(context: ItemContext): FlowMutation | undefined {
    const { dom, item, assignmentName, targetReference } = context
    const boolean = booleanIn(dom, item, 'value')
    if (!boolean) return undefined
    return textMutation(dom, boolean.element, boolean.inverted, {
      mutatorName: this.name,
      elementName: assignmentName,
      description: `Inverted boolean assignment '${targetReference}' in '${assignmentName}' from '${boolean.value}' to '${boolean.value === 'true' ? 'false' : 'true'}'`,
    })
  }

  private mutateNumber(context: ItemContext): FlowMutation | undefined {
    const { dom, item, assignmentName, targetReference } = context
    const numberValue = firstNested(dom, item, 'value', 'numberValue')
    const current = dom.text(numberValue)
    // No element, or no text, reads as NaN too: one check covers all three.
    const value = Number(current)
    if (Number.isNaN(value)) {
      return undefined
    }
    const mutated = value === 0 ? '1.0' : '0.0'
    return textMutation(dom, numberValue as Element, mutated, {
      mutatorName: this.name,
      elementName: assignmentName,
      description: `Changed numeric assignment '${targetReference}' in '${assignmentName}' from '${current}' to '${mutated}'`,
    })
  }

  // Add and Subtract only swap where both mean arithmetic: not on a text or
  // a collection, nor with a text value or a reference to one (Add appends
  // there, Subtract is refused), and not by zero (the swap would change
  // nothing).
  private mutateOperator(
    context: ItemContext,
    resources: Map<string | undefined, Element>
  ): FlowMutation | undefined {
    const { dom, item, assignmentName, targetReference } = context
    const operator = dom.child(item, 'operator')
    const current = dom.text(operator)
    const mutated = current && OPERATOR_SWAPS.get(current)
    if (!operator || !mutated) return undefined
    const valueReference = dom.text(
      firstNested(dom, item, 'value', 'elementReference')
    )
    const appends =
      firstNested(dom, item, 'value', 'stringValue') !== undefined ||
      isTextOrCollection(dom, resources.get(targetReference)) ||
      isTextOrCollection(dom, resources.get(valueReference))
    const byZero =
      Number(dom.text(firstNested(dom, item, 'value', 'numberValue'))) === 0
    if (appends || byZero) return undefined
    return textMutation(dom, operator, mutated, {
      mutatorName: this.name,
      elementName: assignmentName,
      description: `Changed assignment operator '${current}' to '${mutated}' for '${targetReference}' in '${assignmentName}'`,
    })
  }
}
