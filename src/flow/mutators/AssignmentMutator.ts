import type { Element } from '@xmldom/xmldom'
import type { FlowMutation, FlowMutator } from '../types.js'
import type { FlowXmlDom } from '../xml/FlowXmlDom.js'
import { firstNested, invertBoolean, textMutation } from './textMutation.js'

const OPERATOR_SWAPS = new Map<string, string>([
  ['Add', 'Subtract'],
  ['Subtract', 'Add'],
])

interface ItemContext {
  dom: FlowXmlDom
  item: Element
  assignmentName: string
  targetReference: string
}

export class AssignmentMutator implements FlowMutator {
  public readonly name = 'AssignmentMutator'

  public mutate(dom: FlowXmlDom): FlowMutation[] {
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
            this.mutateOperator(context),
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
    const booleanValue = firstNested(dom, item, 'value', 'booleanValue')
    const current = dom.text(booleanValue)?.toLowerCase()
    const mutated = invertBoolean(current)
    if (!booleanValue || !mutated) return undefined
    return textMutation(dom, booleanValue, mutated, {
      mutatorName: this.name,
      elementName: assignmentName,
      description: `Inverted boolean assignment '${targetReference}' in '${assignmentName}' from '${current}' to '${mutated}'`,
    })
  }

  private mutateNumber(context: ItemContext): FlowMutation | undefined {
    const { dom, item, assignmentName, targetReference } = context
    const numberValue = firstNested(dom, item, 'value', 'numberValue')
    if (!numberValue) return undefined
    const current = dom.text(numberValue) ?? '0'
    const value = Number(current)
    if (Number.isNaN(value)) return undefined
    const mutated = value === 0 ? '1.0' : '0.0'
    return textMutation(dom, numberValue, mutated, {
      mutatorName: this.name,
      elementName: assignmentName,
      description: `Changed numeric assignment '${targetReference}' in '${assignmentName}' from '${current}' to '${mutated}'`,
    })
  }

  private mutateOperator(context: ItemContext): FlowMutation | undefined {
    const { dom, item, assignmentName, targetReference } = context
    const operator = dom.elements('operator', item)[0]
    const current = dom.text(operator)
    const mutated = current && OPERATOR_SWAPS.get(current)
    if (!operator || !mutated) return undefined
    return textMutation(dom, operator, mutated, {
      mutatorName: this.name,
      elementName: assignmentName,
      description: `Changed assignment operator '${current}' to '${mutated}' for '${targetReference}' in '${assignmentName}'`,
    })
  }
}
