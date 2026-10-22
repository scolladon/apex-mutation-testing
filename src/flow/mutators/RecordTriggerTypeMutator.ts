import type { FlowMutant, FlowMutator } from '../types.js'
import { FlowXmlDom } from '../xml/FlowXmlDom.js'

const TRIGGER_REPLACEMENTS: Record<string, string[]> = {
  Create: ['Update'],
  Update: ['Create'],
  CreateAndUpdate: ['Create', 'Update'],
}

export class RecordTriggerTypeMutator implements FlowMutator {
  public readonly name = 'RecordTriggerTypeMutator'

  public mutate(xmlContent: string): Omit<FlowMutant, 'id' | 'status'>[] {
    const results: Omit<FlowMutant, 'id' | 'status'>[] = []
    const dom = FlowXmlDom.parse(xmlContent)
    const triggerNodes = dom.queryNodes('//sf:start/sf:recordTriggerType')

    if (triggerNodes.length === 0) {
      return results
    }

    const originalValue = triggerNodes[0].textContent?.trim()
    if (!originalValue) {
      return results
    }
    const replacements = TRIGGER_REPLACEMENTS[originalValue]
    if (!replacements) {
      return results
    }

    for (const replacement of replacements) {
      const clonedDom = FlowXmlDom.parse(xmlContent)
      const targetNode = clonedDom.queryNodes(
        '//sf:start/sf:recordTriggerType'
      )[0]
      targetNode.textContent = replacement

      const line = (targetNode as unknown as { lineNumber?: number }).lineNumber
      results.push({
        mutatorName: this.name,
        elementName: '$Start',
        lineNumber: line,
        description: `Changed recordTriggerType from '${originalValue}' to '${replacement}'`,
        originalSnippet: `<recordTriggerType>${originalValue}</recordTriggerType>`,
        mutatedSnippet: `<recordTriggerType>${replacement}</recordTriggerType>`,
        mutatedXml: clonedDom.serialize(),
      })
    }

    return results
  }
}
