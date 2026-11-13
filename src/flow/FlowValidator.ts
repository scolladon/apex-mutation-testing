import { FlowXmlDom } from './xml/FlowXmlDom.js'

// Why a Flow cannot be mutation tested. Each reason maps to one message key
// in the Flow command's bundle (error.flowInvalid.<reason>), so the wording
// lives with every other user-facing string instead of in this module.
type FlowRejection =
  | { reason: 'invalidXml'; detail: string }
  | { reason: 'notAFlow' }
  | { reason: 'unsupportedProcessType'; processType: string }
  | { reason: 'hasPauseElements' }
  | { reason: 'hasScreenElements' }

export type FlowValidationResult =
  | { isValid: true; dom: FlowXmlDom }
  | ({ isValid: false } & FlowRejection)

const AUTOLAUNCHED_PROCESS_TYPE = 'AutoLaunchedFlow'

// FlowTests only exercise record-triggered and autolaunched flows, and
// neither kind may pause or show a screen while under test.
export class FlowValidator {
  public validate(xml: string): FlowValidationResult {
    let dom: FlowXmlDom
    try {
      dom = FlowXmlDom.parse(xml)
    } catch (error: unknown) {
      return {
        isValid: false,
        reason: 'invalidXml',
        detail: error instanceof Error ? error.message : String(error),
      }
    }
    if (!dom.isRoot('Flow')) {
      return { isValid: false, reason: 'notAFlow' }
    }

    const processType = dom.childText(dom.root, 'processType') ?? ''
    const start = dom.child(dom.root, 'start')
    const isRecordTriggered =
      start !== undefined &&
      (dom.childText(start, 'recordTriggerType') !== undefined ||
        (dom.childText(start, 'triggerType') ?? '').startsWith('Record'))
    if (processType !== AUTOLAUNCHED_PROCESS_TYPE && !isRecordTriggered) {
      return { isValid: false, reason: 'unsupportedProcessType', processType }
    }
    if (dom.elements('waits').length > 0) {
      return { isValid: false, reason: 'hasPauseElements' }
    }
    if (dom.elements('screens').length > 0) {
      return { isValid: false, reason: 'hasScreenElements' }
    }
    return { isValid: true, dom }
  }
}
