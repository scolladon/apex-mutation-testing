import { describe, expect, it } from 'vitest'
import { FlowXmlDom, SF_NAMESPACE } from '../../../src/flow/xml/FlowXmlDom.js'

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="${SF_NAMESPACE}">
    <apiVersion>67.0</apiVersion>
    <label>Test Flow</label>
    <emptyElement></emptyElement>
</Flow>`

describe('FlowXmlDom', () => {
  it('parses valid XML and queries nodes', () => {
    const dom = FlowXmlDom.parse(SAMPLE_XML)
    const apiVersionNodes = dom.queryNodes('//sf:apiVersion')
    expect(apiVersionNodes).toHaveLength(1)
    expect(dom.getText('//sf:apiVersion')).toBe('67.0')
    expect(dom.getText('//sf:label')).toBe('Test Flow')
  })

  it('returns undefined for non-existent or empty nodes', () => {
    const dom = FlowXmlDom.parse(SAMPLE_XML)
    expect(dom.getText('//sf:nonExistent')).toBeUndefined()
    expect(dom.getText('//sf:emptyElement')).toBeUndefined()
  })

  it('serializes document correctly', () => {
    const dom = FlowXmlDom.parse(SAMPLE_XML)
    const serialized = dom.serialize()
    expect(serialized).toContain('<apiVersion>67.0</apiVersion>')
    expect(serialized).toContain('<label>Test Flow</label>')
  })

  it('exposes underlying Document', () => {
    const dom = FlowXmlDom.parse(SAMPLE_XML)
    expect(dom.getDocument()).toBeDefined()
  })

  it('queries nodes with context node', () => {
    const dom = FlowXmlDom.parse(SAMPLE_XML)
    const root = dom.queryNodes('/sf:Flow')[0]
    const label = dom.getText('sf:label', root)
    expect(label).toBe('Test Flow')
  })

  it('returns empty array when xpath expression does not match any nodes', () => {
    const dom = FlowXmlDom.parse(SAMPLE_XML)
    expect(dom.queryNodes('//sf:unknownTag')).toEqual([])
  })

  it('throws on fatal XML parsing error', () => {
    expect(() => FlowXmlDom.parse('<<<invalid xml>>>')).toThrow(
      'XML parsing failed'
    )
  })
})
