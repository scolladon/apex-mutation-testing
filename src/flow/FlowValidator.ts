import { FlowXmlDom } from './xml/FlowXmlDom.js'

export interface FlowValidationResult {
  isValid: boolean
  processType?: string
  isRecordTrigger: boolean
  isAutolaunched: boolean
  errorMessage?: string
}

export class FlowValidator {
  public static validate(xmlContent: string): FlowValidationResult {
    let dom: FlowXmlDom
    try {
      dom = FlowXmlDom.parse(xmlContent)
    } catch (e) {
      return {
        isValid: false,
        isRecordTrigger: false,
        isAutolaunched: false,
        errorMessage: `Invalid XML format: ${(e as Error).message}`,
      }
    }

    const flowNodes = dom.queryNodes('/sf:Flow')
    if (flowNodes.length === 0) {
      return {
        isValid: false,
        isRecordTrigger: false,
        isAutolaunched: false,
        errorMessage:
          'Root element must be <Flow> with namespace http://soap.sforce.com/2006/04/metadata',
      }
    }

    const processType = dom.getText('/sf:Flow/sf:processType') ?? ''
    const recordTriggerType = dom.getText(
      '/sf:Flow/sf:start/sf:recordTriggerType'
    )
    const triggerType = dom.getText('/sf:Flow/sf:start/sf:triggerType')
    const isRecordTrigger = Boolean(
      recordTriggerType || (triggerType && triggerType.startsWith('Record'))
    )
    const isAutolaunched = processType === 'AutoLaunchedFlow'

    // Flow Tests in Salesforce only support Record-Triggered Flows and Autolaunched Flows
    if (!isAutolaunched && !isRecordTrigger) {
      return {
        isValid: false,
        processType,
        isRecordTrigger,
        isAutolaunched,
        errorMessage: `Unsupported processType '${processType}'. Only Record-Triggered Flows and Autolaunched Flows can be tested with FlowTests.`,
      }
    }

    // Check for Pause/Wait elements: <waits>. These cannot be present when Flow is Tested.
    const waitNodes = dom.queryNodes('//sf:waits')
    if (waitNodes.length > 0) {
      return {
        isValid: false,
        processType,
        isRecordTrigger,
        isAutolaunched,
        errorMessage:
          'Flow contains Pause elements (<waits>). Flows with Pause elements cannot be tested with FlowTests.',
      }
    }

    // Check for Screen elements: <screens>. These cannot be present when Flow is Tested.
    const screenNodes = dom.queryNodes('//sf:screens')
    if (screenNodes.length > 0) {
      return {
        isValid: false,
        processType,
        isRecordTrigger,
        isAutolaunched,
        errorMessage:
          'Flow contains Screen elements (<screens>). Screen Flows cannot be tested with FlowTests.',
      }
    }

    return {
      isValid: true,
      processType,
      isRecordTrigger,
      isAutolaunched,
    }
  }
}
