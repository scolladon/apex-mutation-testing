import type { FlowMutant, FlowMutator } from '../types.js'
import { FlowXmlDom } from '../xml/FlowXmlDom.js'

export class AssignmentMutator implements FlowMutator {
  public readonly name = 'AssignmentMutator'

  public mutate(xmlContent: string): Omit<FlowMutant, 'id' | 'status'>[] {
    const results: Omit<FlowMutant, 'id' | 'status'>[] = []
    const baseDom = FlowXmlDom.parse(xmlContent)
    const assignmentNodes = baseDom.queryNodes('//sf:assignments')

    assignmentNodes.forEach((assignmentNode, aIdx) => {
      const assignmentName =
        baseDom.getText('sf:name', assignmentNode) ?? `Assignment_${aIdx}`

      const itemNodes = baseDom.queryNodes(
        './/sf:assignmentItems',
        assignmentNode
      )

      itemNodes.forEach((itemNode, iIdx) => {
        const targetRef =
          baseDom.getText('sf:assignToReference', itemNode) ?? `Item_${iIdx}`

        // 1. String value mutation
        const strValNodes = baseDom.queryNodes(
          './/sf:value/sf:stringValue',
          itemNode
        )
        if (strValNodes.length > 0) {
          const currentVal = strValNodes[0].textContent || ''
          const mutatedVal = currentVal === '' ? 'MUTATED' : ''

          const clonedDom = FlowXmlDom.parse(xmlContent)
          const targetAssignment =
            clonedDom.queryNodes('//sf:assignments')[aIdx]
          const targetItem = clonedDom.queryNodes(
            './/sf:assignmentItems',
            targetAssignment
          )[iIdx]
          const targetStrNode = clonedDom.queryNodes(
            './/sf:value/sf:stringValue',
            targetItem
          )[0]
          targetStrNode.textContent = mutatedVal

          const line = (strValNodes[0] as unknown as { lineNumber?: number })
            .lineNumber

          results.push({
            mutatorName: this.name,
            elementName: assignmentName,
            lineNumber: line,
            description: `Changed assignment '${targetRef}' in '${assignmentName}' from '${currentVal}' to '${mutatedVal}'`,
            originalSnippet: `<stringValue>${currentVal}</stringValue>`,
            mutatedSnippet: `<stringValue>${mutatedVal}</stringValue>`,
            mutatedXml: clonedDom.serialize(),
          })
        }

        // 2. Boolean value mutation
        const boolValNodes = baseDom.queryNodes(
          './/sf:value/sf:booleanValue',
          itemNode
        )
        if (boolValNodes.length > 0) {
          const currentVal = boolValNodes[0].textContent?.trim().toLowerCase()
          if (currentVal === 'true' || currentVal === 'false') {
            const mutatedVal = currentVal === 'true' ? 'false' : 'true'

            const clonedDom = FlowXmlDom.parse(xmlContent)
            const targetAssignment =
              clonedDom.queryNodes('//sf:assignments')[aIdx]
            const targetItem = clonedDom.queryNodes(
              './/sf:assignmentItems',
              targetAssignment
            )[iIdx]
            const targetBoolNode = clonedDom.queryNodes(
              './/sf:value/sf:booleanValue',
              targetItem
            )[0]
            targetBoolNode.textContent = mutatedVal

            const line = (boolValNodes[0] as unknown as { lineNumber?: number })
              .lineNumber

            results.push({
              mutatorName: this.name,
              elementName: assignmentName,
              lineNumber: line,
              description: `Inverted boolean assignment '${targetRef}' in '${assignmentName}' from '${currentVal}' to '${mutatedVal}'`,
              originalSnippet: `<booleanValue>${currentVal}</booleanValue>`,
              mutatedSnippet: `<booleanValue>${mutatedVal}</booleanValue>`,
              mutatedXml: clonedDom.serialize(),
            })
          }
        }

        // 3. Number value mutation
        const numValNodes = baseDom.queryNodes(
          './/sf:value/sf:numberValue',
          itemNode
        )
        if (numValNodes.length > 0) {
          const currentVal = numValNodes[0].textContent?.trim() || '0'
          const num = Number(currentVal)
          if (!Number.isNaN(num)) {
            const mutatedVal = num === 0 ? '1.0' : '0.0'

            const clonedDom = FlowXmlDom.parse(xmlContent)
            const targetAssignment =
              clonedDom.queryNodes('//sf:assignments')[aIdx]
            const targetItem = clonedDom.queryNodes(
              './/sf:assignmentItems',
              targetAssignment
            )[iIdx]
            const targetNumNode = clonedDom.queryNodes(
              './/sf:value/sf:numberValue',
              targetItem
            )[0]
            targetNumNode.textContent = mutatedVal

            const line = (numValNodes[0] as unknown as { lineNumber?: number })
              .lineNumber

            results.push({
              mutatorName: this.name,
              elementName: assignmentName,
              lineNumber: line,
              description: `Changed numeric assignment '${targetRef}' in '${assignmentName}' from '${currentVal}' to '${mutatedVal}'`,
              originalSnippet: `<numberValue>${currentVal}</numberValue>`,
              mutatedSnippet: `<numberValue>${mutatedVal}</numberValue>`,
              mutatedXml: clonedDom.serialize(),
            })
          }
        }

        // 4. Operator mutation: Add <-> Subtract
        const opNodes = baseDom.queryNodes('.//sf:operator', itemNode)
        if (opNodes.length > 0) {
          const currentOp = opNodes[0].textContent?.trim()
          let mutatedOp: string | undefined
          if (currentOp === 'Add') mutatedOp = 'Subtract'
          else if (currentOp === 'Subtract') mutatedOp = 'Add'

          if (mutatedOp) {
            const clonedDom = FlowXmlDom.parse(xmlContent)
            const targetAssignment =
              clonedDom.queryNodes('//sf:assignments')[aIdx]
            const targetItem = clonedDom.queryNodes(
              './/sf:assignmentItems',
              targetAssignment
            )[iIdx]
            const targetOpNode = clonedDom.queryNodes(
              './/sf:operator',
              targetItem
            )[0]
            targetOpNode.textContent = mutatedOp

            const line = (opNodes[0] as unknown as { lineNumber?: number })
              .lineNumber

            results.push({
              mutatorName: this.name,
              elementName: assignmentName,
              lineNumber: line,
              description: `Changed assignment operator '${currentOp}' to '${mutatedOp}' for '${targetRef}' in '${assignmentName}'`,
              originalSnippet: `<operator>${currentOp}</operator>`,
              mutatedSnippet: `<operator>${mutatedOp}</operator>`,
              mutatedXml: clonedDom.serialize(),
            })
          }
        }
      })
    })

    return results
  }
}
