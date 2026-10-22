import { describe, expect, it } from 'vitest'
import { FlowValidator } from '../../../src/flow/FlowValidator.js'

describe('FlowValidator', () => {
  it('accepts a valid Record-Triggered Flow', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>67.0</apiVersion>
    <processType>AutoLaunchedFlow</processType>
    <start>
        <object>Account</object>
        <recordTriggerType>Create</recordTriggerType>
        <triggerType>RecordAfterSave</triggerType>
    </start>
    <status>Active</status>
</Flow>`

    const result = FlowValidator.validate(xml)
    expect(result.isValid).toBe(true)
    expect(result.isRecordTrigger).toBe(true)
    expect(result.isAutolaunched).toBe(true)
    expect(result.errorMessage).toBeUndefined()
  })

  it('accepts a valid Autolaunched Flow without triggers', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>67.0</apiVersion>
    <processType>AutoLaunchedFlow</processType>
    <status>Active</status>
</Flow>`

    const result = FlowValidator.validate(xml)
    expect(result.isValid).toBe(true)
    expect(result.isAutolaunched).toBe(true)
    expect(result.isRecordTrigger).toBe(false)
  })

  it('rejects invalid XML', () => {
    const xml = `<NotAClosedTag>`
    const result = FlowValidator.validate(xml)
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toContain('Invalid XML format')
  })

  it('accepts a Record-Triggered Flow with triggerType starting with Record', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>67.0</apiVersion>
    <processType>AutoLaunchedFlow</processType>
    <start>
        <object>Account</object>
        <triggerType>RecordBeforeSave</triggerType>
    </start>
    <status>Active</status>
</Flow>`

    const result = FlowValidator.validate(xml)
    expect(result.isValid).toBe(true)
    expect(result.isRecordTrigger).toBe(true)
  })

  it('rejects XML without <Flow> root element', () => {
    const xml = `<OtherElement xmlns="http://soap.sforce.com/2006/04/metadata"></OtherElement>`
    const result = FlowValidator.validate(xml)
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toContain('Root element must be <Flow>')
  })

  it('rejects unsupported processType like Screen Flow', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>67.0</apiVersion>
    <processType>Flow</processType>
    <status>Active</status>
</Flow>`

    const result = FlowValidator.validate(xml)
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toContain(
      "Unsupported processType 'Flow'. Only Record-Triggered Flows and Autolaunched Flows can be tested"
    )
  })

  it('rejects Flow containing Pause elements (<waits>)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>67.0</apiVersion>
    <processType>AutoLaunchedFlow</processType>
    <waits>
        <name>Wait_For_Approval</name>
        <label>Wait For Approval</label>
    </waits>
    <status>Active</status>
</Flow>`

    const result = FlowValidator.validate(xml)
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toContain(
      'Flow contains Pause elements (<waits>)'
    )
  })

  it('handles Flow without <processType> element', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>67.0</apiVersion>
    <start>
        <object>Account</object>
        <recordTriggerType>Create</recordTriggerType>
    </start>
    <status>Active</status>
</Flow>`

    const result = FlowValidator.validate(xml)
    expect(result.isValid).toBe(true)
    expect(result.processType).toBe('')
    expect(result.isRecordTrigger).toBe(true)
  })

  it('rejects Flow containing Screen elements (<screens>)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>67.0</apiVersion>
    <processType>AutoLaunchedFlow</processType>
    <screens>
        <name>User_Input_Screen</name>
    </screens>
    <status>Active</status>
</Flow>`

    const result = FlowValidator.validate(xml)
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toContain(
      'Flow contains Screen elements (<screens>)'
    )
  })
})
