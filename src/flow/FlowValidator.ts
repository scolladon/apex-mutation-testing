import { FlowXmlDom } from './xml/FlowXmlDom.js'

// Why a Flow cannot be mutation tested. Each reason maps to one message key
// in the Flow command's bundle (error.flowInvalid.<reason>), so the wording
// lives with every other user-facing string instead of in this module.
type FlowRejection =
  | { reason: 'invalidXml'; detail: string }
  | { reason: 'notAFlow' }
  | { reason: 'unsupportedProcessType'; processType: string }
  | { reason: 'deleteTriggered' }
  | { reason: 'platformEventTriggered' }
  | { reason: 'scheduleTriggered' }
  | { reason: 'hasPauseElements' }
  | { reason: 'hasScreenElements' }

export type FlowValidationResult =
  | { isValid: true; dom: FlowXmlDom }
  | ({ isValid: false } & FlowRejection)

const AUTOLAUNCHED_PROCESS_TYPE = 'AutoLaunchedFlow'

// Start triggers FlowTests cannot run: a flow triggered when a record is
// deleted, by a platform event, or on a schedule.
const TRIGGER_REJECTIONS = new Map<string, FlowRejection['reason']>([
  ['RecordBeforeDelete', 'deleteTriggered'],
  ['PlatformEvent', 'platformEventTriggered'],
  ['Scheduled', 'scheduleTriggered'],
])

// FlowTests only exercise record-triggered and autolaunched flows started on
// create or update, and neither kind may pause or show a screen while under
// test.
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
    const triggerType = start && dom.childText(start, 'triggerType')
    const recordTriggerType = start && dom.childText(start, 'recordTriggerType')
    const isRecordTriggered =
      recordTriggerType !== undefined || triggerType?.startsWith('Record')
    if (processType !== AUTOLAUNCHED_PROCESS_TYPE && !isRecordTriggered) {
      return { isValid: false, reason: 'unsupportedProcessType', processType }
    }
    const rejected =
      recordTriggerType === 'Delete'
        ? 'deleteTriggered'
        : // a missing trigger type finds nothing, like any unlisted one
          TRIGGER_REJECTIONS.get(triggerType as string)
    if (rejected) {
      return { isValid: false, reason: rejected } as FlowValidationResult
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
