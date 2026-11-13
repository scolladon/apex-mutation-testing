import type { Element } from '@xmldom/xmldom'
import type { FlowMutation, FlowMutator } from '../types.js'
import type { FlowXmlDom } from '../xml/FlowXmlDom.js'
import { firstNested, invertBoolean, textMutation } from './textMutation.js'

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
      return dom
        .elements('conditions', decision)
        .flatMap(condition =>
          this.mutateCondition(dom, condition, decisionName)
        )
    })
  }

  private mutateCondition(
    dom: FlowXmlDom,
    condition: Element,
    decisionName: string
  ): FlowMutation[] {
    const mutations: FlowMutation[] = []
    const operator = dom.elements('operator', condition)[0]
    const currentOperator = dom.text(operator)
    const invertedOperator =
      currentOperator && OPERATOR_INVERSIONS.get(currentOperator)
    if (operator && invertedOperator) {
      mutations.push(
        textMutation(dom, operator, invertedOperator, {
          mutatorName: this.name,
          elementName: decisionName,
          description: `Inverted condition operator '${currentOperator}' to '${invertedOperator}' in decision '${decisionName}'`,
        })
      )
    }

    // e.g. IsNull/IsBlank checks, or a boolean equality
    const booleanValue = firstNested(
      dom,
      condition,
      'rightValue',
      'booleanValue'
    )
    const currentBoolean = dom.text(booleanValue)?.toLowerCase()
    const invertedBoolean = invertBoolean(currentBoolean)
    if (booleanValue && invertedBoolean) {
      const leftReference =
        dom.childText(condition, 'leftValueReference') ?? 'condition'
      mutations.push(
        textMutation(dom, booleanValue, invertedBoolean, {
          mutatorName: this.name,
          elementName: decisionName,
          description: `Inverted condition '${leftReference} ${currentOperator ?? ''}' from '${currentBoolean}' to '${invertedBoolean}' in decision '${decisionName}'`,
        })
      )
    }
    return mutations
  }
}
