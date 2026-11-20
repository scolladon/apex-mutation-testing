import type { Element } from '@xmldom/xmldom'
import type { FlowMutation, FlowMutator } from '../types.js'
import type { FlowXmlDom } from '../xml/FlowXmlDom.js'
import { booleanIn, textMutation } from './textMutation.js'

const OPERATOR_INVERSIONS = new Map<string, string>([
  ['EqualTo', 'NotEqualTo'],
  ['NotEqualTo', 'EqualTo'],
  ['GreaterThan', 'LessThanOrEqualTo'],
  ['LessThanOrEqualTo', 'GreaterThan'],
  ['LessThan', 'GreaterThanOrEqualTo'],
  ['GreaterThanOrEqualTo', 'LessThan'],
])

export class DecisionOperatorMutator implements FlowMutator {
  public readonly name = 'DecisionOperatorMutator'

  public mutate(dom: FlowXmlDom): FlowMutation[] {
    return dom.elements('decisions').flatMap((decision, index) => {
      const decisionName =
        dom.childText(decision, 'name') ?? `Decision_${index}`
      return dom.elements('rules', decision).flatMap(rule => {
        const where = `in rule '${dom.childText(rule, 'name') ?? 'Rule'}' of decision '${decisionName}'`
        return dom
          .children(rule, 'conditions')
          .flatMap(condition =>
            this.mutateCondition(dom, condition, decisionName, where)
          )
      })
    })
  }

  // One mutant per condition: the operator inverted where it has an
  // inversion; otherwise (IsNull, IsChanged, IsBlank, WasSet…) the boolean
  // it is compared with. Doing both on `EqualTo true` would make two mutants
  // of one change, since `NotEqualTo true` and `EqualTo false` only differ
  // for a null boolean.
  private mutateCondition(
    dom: FlowXmlDom,
    condition: Element,
    decisionName: string,
    where: string
  ): FlowMutation[] {
    const left = dom.childText(condition, 'leftValueReference') ?? 'condition'
    const operator = dom.child(condition, 'operator')
    const currentOperator = dom.text(operator)
    const invertedOperator =
      currentOperator && OPERATOR_INVERSIONS.get(currentOperator)
    if (operator && invertedOperator) {
      return [
        textMutation(dom, operator, invertedOperator, {
          mutatorName: this.name,
          elementName: decisionName,
          description: `Inverted operator of '${left}' from '${currentOperator}' to '${invertedOperator}' ${where}`,
        }),
      ]
    }
    const boolean = booleanIn(dom, condition, 'rightValue')
    if (!boolean) return []
    const verb = currentOperator ? ` ${currentOperator}` : ''
    return [
      textMutation(dom, boolean.element, boolean.inverted, {
        mutatorName: this.name,
        elementName: decisionName,
        description: `Inverted '${left}${verb}' from '${boolean.value}' to '${boolean.value === 'true' ? 'false' : 'true'}' ${where}`,
      }),
    ]
  }
}
