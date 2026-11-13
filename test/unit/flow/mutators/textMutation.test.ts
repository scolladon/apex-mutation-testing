import { getDefaultFlowMutators } from '../../../../src/flow/mutators/index.js'
import {
  firstNested,
  invertBoolean,
  textMutation,
} from '../../../../src/flow/mutators/textMutation.js'
import { FlowXmlDom } from '../../../../src/flow/xml/FlowXmlDom.js'
import { flowXml } from '../../../utils/flowFixtures.js'

describe('textMutation helpers', () => {
  const dom = FlowXmlDom.parse(
    flowXml(`    <assignmentItems>
        <value><elementReference>x</elementReference></value>
        <value><stringValue>s</stringValue></value>
    </assignmentItems>`)
  )

  it('Given a leaf element, When building a text mutation, Then it carries the label and one edit', () => {
    // Arrange
    const status = dom.child(dom.root, 'status')!

    // Act
    const sut = textMutation(dom, status, 'Active', {
      mutatorName: 'M',
      elementName: 'E',
      description: 'D',
    })

    // Assert
    expect(sut).toEqual({
      mutatorName: 'M',
      elementName: 'E',
      description: 'D',
      edits: [dom.replaceTextEdit(status, 'Active')],
    })
  })

  it('Given several containers, When looking for a nested element, Then the first container holding it answers', () => {
    // Act
    const sut = firstNested(dom, dom.root, 'value', 'stringValue')

    // Assert
    expect(dom.text(sut)).toBe('s')
    expect(firstNested(dom, dom.root, 'value', 'numberValue')).toBeUndefined()
  })

  it.each([
    ['true', 'false'],
    ['false', 'true'],
    ['other', undefined],
    [undefined, undefined],
  ])('Given %s, When inverted, Then it is %s', (value, expected) => {
    // Act & Assert
    expect(invertBoolean(value)).toBe(expected)
  })

  it('Given the default registry, When listed, Then every Flow mutator is present in order', () => {
    // Act & Assert
    expect(getDefaultFlowMutators().map(m => m.name)).toEqual([
      'RecordTriggerTypeMutator',
      'FormulaExpressionMutator',
      'ConnectorBypassMutator',
      'DecisionOperatorMutator',
      'AssignmentMutator',
    ])
  })
})
