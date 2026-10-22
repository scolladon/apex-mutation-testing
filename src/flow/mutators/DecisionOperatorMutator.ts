import type { FlowMutant, FlowMutator } from '../types.js'
import { FlowXmlDom } from '../xml/FlowXmlDom.js'

const OPERATOR_INVERSIONS: Record<string, string> = {
  EqualTo: 'NotEqualTo',
  NotEqualTo: 'EqualTo',
  GreaterThan: 'LessThanOrEqualTo',
  LessThanOrEqualTo: 'GreaterThan',
  LessThan: 'GreaterThanOrEqualTo',
  GreaterThanOrEqualTo: 'LessThan',
}

export class DecisionOperatorMutator implements FlowMutator {
  public readonly name = 'DecisionOperatorMutator'

  public mutate(xmlContent: string): Omit<FlowMutant, 'id' | 'status'>[] {
    const results: Omit<FlowMutant, 'id' | 'status'>[] = []
    const baseDom = FlowXmlDom.parse(xmlContent)
    const decisionNodes = baseDom.queryNodes('//sf:decisions')

    decisionNodes.forEach((decisionNode, dIdx) => {
      const decisionName =
        baseDom.getText('sf:name', decisionNode) ?? `Decision_${dIdx}`

      const conditionNodes = baseDom.queryNodes(
        './/sf:conditions',
        decisionNode
      )

      conditionNodes.forEach((condNode, cIdx) => {
        const opNodes = baseDom.queryNodes('.//sf:operator', condNode)
        const currentOp = opNodes[0]?.textContent?.trim()

        // 1. Invert operator if in OPERATOR_INVERSIONS
        if (currentOp && OPERATOR_INVERSIONS[currentOp]) {
          const invertedOp = OPERATOR_INVERSIONS[currentOp]
          const clonedDom = FlowXmlDom.parse(xmlContent)
          const targetDecision = clonedDom.queryNodes('//sf:decisions')[dIdx]
          const targetCond = clonedDom.queryNodes(
            './/sf:conditions',
            targetDecision
          )[cIdx]
          const targetOpNode = clonedDom.queryNodes(
            './/sf:operator',
            targetCond
          )[0]
          targetOpNode.textContent = invertedOp

          const line = (opNodes[0] as unknown as { lineNumber?: number })
            .lineNumber

          results.push({
            mutatorName: this.name,
            elementName: decisionName,
            lineNumber: line,
            description: `Inverted condition operator '${currentOp}' to '${invertedOp}' in decision '${decisionName}'`,
            originalSnippet: `<operator>${currentOp}</operator>`,
            mutatedSnippet: `<operator>${invertedOp}</operator>`,
            mutatedXml: clonedDom.serialize(),
          })
        }

        // 2. Invert rightValue booleanValue (e.g. for IsBlank, IsNull, or boolean equality)
        const boolNodes = baseDom.queryNodes(
          './/sf:rightValue/sf:booleanValue',
          condNode
        )
        if (boolNodes.length > 0) {
          const currentBool = boolNodes[0]?.textContent?.trim().toLowerCase()
          if (currentBool === 'true' || currentBool === 'false') {
            const invertedBool = currentBool === 'true' ? 'false' : 'true'
            const leftRef =
              baseDom.getText('sf:leftValueReference', condNode) ?? 'condition'

            const clonedDom = FlowXmlDom.parse(xmlContent)
            const targetDecision = clonedDom.queryNodes('//sf:decisions')[dIdx]
            const targetCond = clonedDom.queryNodes(
              './/sf:conditions',
              targetDecision
            )[cIdx]
            const targetBoolNode = clonedDom.queryNodes(
              './/sf:rightValue/sf:booleanValue',
              targetCond
            )[0]
            targetBoolNode.textContent = invertedBool

            const line = (boolNodes[0] as unknown as { lineNumber?: number })
              .lineNumber

            results.push({
              mutatorName: this.name,
              elementName: decisionName,
              lineNumber: line,
              description: `Inverted condition '${leftRef} ${currentOp ?? ''}' from '${currentBool}' to '${invertedBool}' in decision '${decisionName}'`,
              originalSnippet: `<booleanValue>${currentBool}</booleanValue>`,
              mutatedSnippet: `<booleanValue>${invertedBool}</booleanValue>`,
              mutatedXml: clonedDom.serialize(),
            })
          }
        }
      })
    })

    return results
  }
}
