import { FlowValidator } from '../../../src/flow/FlowValidator.js'
import { FlowXmlDom, SF_NAMESPACE } from '../../../src/flow/xml/FlowXmlDom.js'
import { flowXml, recordTriggeredFlowXml } from '../../utils/flowFixtures.js'

describe('FlowValidator', () => {
  const sut = new FlowValidator()

  it('Given a record-triggered flow, When validated, Then it is valid and exposes the parsed document', () => {
    // Act
    const result = sut.validate(recordTriggeredFlowXml())

    // Assert
    expect(result.isValid).toBe(true)
    expect(result.isValid && result.dom.isRoot('Flow')).toBe(true)
  })

  it('Given an autolaunched flow without a record trigger, When validated, Then it is valid', () => {
    // Act
    const result = sut.validate(
      flowXml('    <processType>AutoLaunchedFlow</processType>')
    )

    // Assert
    expect(result.isValid).toBe(true)
  })

  it('Given a record-triggered flow known only by its trigger type, When validated, Then it is valid', () => {
    // Act
    const result = sut.validate(
      flowXml(
        '    <processType>Workflow</processType>\n    <start>\n        <triggerType>RecordBeforeSave</triggerType>\n    </start>'
      )
    )

    // Assert
    expect(result.isValid).toBe(true)
  })

  it('Given a record-triggered flow known only by its record trigger type, When validated, Then it is valid', () => {
    // Act
    const result = sut.validate(
      flowXml(
        '    <processType>Workflow</processType>\n    <start>\n        <recordTriggerType>Create</recordTriggerType>\n    </start>'
      )
    )

    // Assert
    expect(result.isValid).toBe(true)
  })

  it('Given malformed XML, When validated, Then it is rejected as invalid XML with the parser detail', () => {
    // Act
    const result = sut.validate('<Flow><a></Flow>')

    // Assert
    expect(result).toMatchObject({ isValid: false, reason: 'invalidXml' })
    expect(!result.isValid && 'detail' in result && result.detail).toMatch(
      /XML parsing failed/
    )
  })

  it('Given a parser failure that is not an Error, When validated, Then its text is kept as the detail', () => {
    // Arrange
    const throwing = new FlowValidator()
    const parse = vi.spyOn(FlowXmlDom, 'parse').mockImplementation(() => {
      throw 'boom'
    })

    // Act
    const result = throwing.validate('<x/>')

    // Assert
    expect(result).toEqual({
      isValid: false,
      reason: 'invalidXml',
      detail: 'boom',
    })
    parse.mockRestore()
  })

  it('Given another root element, When validated, Then it is rejected as not a Flow', () => {
    // Act
    const result = sut.validate(`<FlowTest xmlns="${SF_NAMESPACE}"/>`)

    // Assert
    expect(result).toEqual({ isValid: false, reason: 'notAFlow' })
  })

  it('Given a screen flow process type with no record trigger, When validated, Then it is rejected with the process type', () => {
    // Act
    const result = sut.validate(flowXml('    <processType>Flow</processType>'))

    // Assert
    expect(result).toEqual({
      isValid: false,
      reason: 'unsupportedProcessType',
      processType: 'Flow',
    })
  })

  it('Given no process type and a start without trigger, When validated, Then it is rejected with an empty process type', () => {
    // Act
    const result = sut.validate(flowXml('    <start>\n    </start>'))

    // Assert
    expect(result).toEqual({
      isValid: false,
      reason: 'unsupportedProcessType',
      processType: '',
    })
  })

  const started = (start: string, processType = 'AutoLaunchedFlow') =>
    flowXml(
      `    <processType>${processType}</processType>\n    <start>\n${start}\n    </start>`
    )

  it.each([
    [
      'a record-delete trigger type',
      '        <triggerType>RecordBeforeDelete</triggerType>',
      'deleteTriggered',
    ],
    [
      'a Delete record trigger',
      '        <recordTriggerType>Delete</recordTriggerType>\n        <triggerType>RecordAfterSave</triggerType>',
      'deleteTriggered',
    ],
    [
      'a platform event trigger',
      '        <triggerType>PlatformEvent</triggerType>',
      'platformEventTriggered',
    ],
    [
      'a schedule trigger',
      '        <triggerType>Scheduled</triggerType>',
      'scheduleTriggered',
    ],
  ])(
    'Given %s, When validated, Then it is rejected up front',
    (_label, start, reason) => {
      // Act & Assert
      expect(sut.validate(started(start))).toEqual({ isValid: false, reason })
    }
  )

  it.each([
    [
      'an after-save trigger',
      '        <triggerType>RecordAfterSave</triggerType>',
    ],
    [
      'an update record trigger',
      '        <recordTriggerType>CreateAndUpdate</recordTriggerType>',
    ],
    ['no trigger at all', '        <object>Account</object>'],
  ])('Given %s, When validated, Then it is accepted', (_label, start) => {
    // Act & Assert
    expect(sut.validate(started(start)).isValid).toBe(true)
  })

  it('Given a non-autolaunched process with a trigger type not starting with Record, When validated, Then it is rejected for its process type', () => {
    // Act & Assert
    expect(
      sut.validate(
        started('        <triggerType>Scheduled</triggerType>', 'Workflow')
      )
    ).toEqual({
      isValid: false,
      reason: 'unsupportedProcessType',
      processType: 'Workflow',
    })
  })

  it('Given an autolaunched flow without a start, When validated, Then it is valid', () => {
    // Act & Assert
    expect(
      sut.validate(flowXml('    <processType>AutoLaunchedFlow</processType>'))
        .isValid
    ).toBe(true)
  })

  it('Given Pause elements, When validated, Then it is rejected', () => {
    // Act
    const result = sut.validate(
      flowXml(
        '    <processType>AutoLaunchedFlow</processType>\n    <waits><name>W</name></waits>'
      )
    )

    // Assert
    expect(result).toEqual({ isValid: false, reason: 'hasPauseElements' })
  })

  it('Given Screen elements, When validated, Then it is rejected', () => {
    // Act
    const result = sut.validate(
      flowXml(
        '    <processType>AutoLaunchedFlow</processType>\n    <screens><name>S</name></screens>'
      )
    )

    // Assert
    expect(result).toEqual({ isValid: false, reason: 'hasScreenElements' })
  })
})
