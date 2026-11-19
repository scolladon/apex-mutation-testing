// cspell:ignore globalconstant
import { getDefaultFlowMutators } from '../../../../src/flow/mutators/index.js'
import {
  booleanIn,
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

  it('Given a leaf element, When building a text mutation, Then it carries the label, one edit, and is anchored where the edit is', () => {
    // Arrange
    const status = dom.child(dom.root, 'status')!
    const edit = dom.replaceTextEdit(status, 'Act&ve')

    // Act
    const sut = textMutation(dom, status, 'Act&ve', {
      mutatorName: 'M',
      elementName: 'E',
      description: 'D',
    })

    // Assert
    expect(sut).toEqual({
      mutatorName: 'M',
      elementName: 'E',
      description: 'D',
      edits: [edit],
      anchor: { start: edit.start, end: edit.end },
      replacement: 'Act&amp;ve',
    })
    expect(dom.source.slice(edit.start, edit.end)).toBe('Draft')
  })

  describe('booleanIn', () => {
    const scope = (value: string) => {
      const parsed = FlowXmlDom.parse(
        flowXml(
          `    <conditions><rightValue>${value}</rightValue></conditions>`
        )
      )
      return { parsed, element: parsed.elements('conditions')[0] }
    }

    it.each([
      ['<booleanValue>true</booleanValue>', 'true', 'false'],
      ['<booleanValue> FALSE </booleanValue>', 'false', 'true'],
      [
        '<elementReference>$GlobalConstant.True</elementReference>',
        'true',
        '$GlobalConstant.False',
      ],
      [
        '<elementReference>$GLOBALCONSTANT.FALSE</elementReference>',
        'false',
        '$GlobalConstant.True',
      ],
    ])(
      'Given %s, When read, Then it is %s and inverts to %s',
      (value, expected, inverted) => {
        // Arrange
        const { parsed, element } = scope(value)

        // Act
        const sut = booleanIn(parsed, element, 'rightValue')

        // Assert
        expect(sut).toEqual({
          element: expect.anything(),
          value: expected,
          inverted,
        })
        expect(parsed.text(sut?.element)?.toLowerCase()).toContain(expected)
      }
    )

    it.each([
      ['<booleanValue>maybe</booleanValue>'],
      ['<elementReference>$GlobalConstant.EmptyString</elementReference>'],
      ['<elementReference>x$GlobalConstant.True</elementReference>'],
      ['<elementReference>$GlobalConstant.TrueValue</elementReference>'],
      ['<elementReference>$GlobalConstantXTrue</elementReference>'],
      ['<elementReference/>'],
      ['<numberValue>1</numberValue>'],
    ])('Given %s, When read, Then it is no boolean', value => {
      // Arrange
      const { parsed, element } = scope(value)

      // Act & Assert
      expect(booleanIn(parsed, element, 'rightValue')).toBeUndefined()
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
