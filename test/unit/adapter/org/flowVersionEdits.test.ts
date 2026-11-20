import {
  leftoverPins,
  pinnedVersions,
  TEMPORARY_VERSION_MARKER,
  toDraftXml,
  unpinFlowTest,
} from '../../../../src/adapter/org/flowVersionEdits.js'
import { SF_NAMESPACE } from '../../../../src/flow/xml/FlowXmlDom.js'
import {
  flowTestXml,
  flowXml,
  recordTriggeredFlowXml,
} from '../../../utils/flowFixtures.js'

describe('flowVersionEdits', () => {
  describe('toDraftXml', () => {
    it('Given an Active flow, When made Draft unmarked, Then only the status changes', () => {
      // Act
      const sut = toDraftXml(recordTriggeredFlowXml('Active'), false)

      // Assert
      expect(sut).toBe(recordTriggeredFlowXml('Draft'))
    })

    it.each([['Draft'], [' Draft ']])(
      'Given a %j status, When made Draft unmarked, Then not one byte changes',
      status => {
        // Arrange
        const xml = recordTriggeredFlowXml(status)

        // Act & Assert
        expect(toDraftXml(xml, false)).toBe(xml)
      }
    )

    it('Given a flow without status, When made Draft, Then a Draft status is inserted', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Flow xmlns="${SF_NAMESPACE}">\n    <apiVersion>66.0</apiVersion>\n</Flow>\n`

      // Act & Assert
      expect(toDraftXml(xml, false)).toContain(
        '    <apiVersion>66.0</apiVersion>\n    <status>Draft</status>\n</Flow>'
      )
    })

    it('Given a flow without description, When marked, Then a description is inserted in alphabetical position', () => {
      // Act
      const sut = toDraftXml(recordTriggeredFlowXml('Active'), true)

      // Assert
      expect(sut).toContain(
        `    <apiVersion>66.0</apiVersion>\n    <description>${TEMPORARY_VERSION_MARKER}</description>\n    <processType>`
      )
      // the marker names the tool to whoever finds a leftover version in Setup
      expect(TEMPORARY_VERSION_MARKER).toBe('[apex-mutation-testing]')
      expect(sut).toContain('<status>Draft</status>')
    })

    it('Given a flow with a description, When marked, Then the marker is appended to it', () => {
      // Act
      const sut = toDraftXml(
        flowXml('    <description>Sets the rating</description>'),
        true
      )

      // Assert
      expect(sut).toContain(
        `<description>Sets the rating ${TEMPORARY_VERSION_MARKER}</description>`
      )
    })

    it('Given a flow with an empty description, When marked, Then the description becomes the marker', () => {
      // Act
      const sut = toDraftXml(flowXml('    <description></description>'), true)

      // Assert
      expect(sut).toContain(
        `<description>${TEMPORARY_VERSION_MARKER}</description>`
      )
    })
  })

  describe('pinnedVersions', () => {
    it('Given pins, When read, Then every pinned version number is returned', () => {
      // Act & Assert
      expect(pinnedVersions(flowTestXml('F', [3, 4]))).toEqual([3, 4])
      expect(pinnedVersions(flowTestXml('F'))).toEqual([])
    })
  })

  describe('unpinFlowTest', () => {
    it('Given a test with no pin, When unpinned, Then the XML is returned unchanged', () => {
      // Arrange
      const xml = flowTestXml('F')

      // Act & Assert
      expect(unpinFlowTest(xml)).toBe(xml)
    })

    const withDescription = (xml: string, description: string) =>
      xml.replace(
        '    <flowApiName>',
        `    <description>${description}</description>\n    <flowApiName>`
      )

    it.each([
      ['one version', [1], '1'],
      ['several versions', [1, 2, 3], '1,2,3'],
    ])(
      'Given a test pinned to %s, When unpinned, Then every association and its line are removed, and the pins are written in a marker',
      (_label, pins, listed) => {
        // Act
        const sut = unpinFlowTest(flowTestXml('F', pins))

        // Assert
        expect(sut).toBe(
          withDescription(
            flowTestXml('F'),
            `[apex-mutation-testing pins=${listed}]`
          )
        )
        expect(pinnedVersions(sut)).toEqual([])
        expect(leftoverPins(sut)).toEqual(pins)
      }
    )

    it('Given a pinned test with a description of its own, When unpinned, Then the marker leads and the description is kept', () => {
      // Arrange
      const xml = withDescription(flowTestXml('F', [4]), 'Checks &amp; rates')

      // Act
      const sut = unpinFlowTest(xml)

      // Assert
      expect(sut).toBe(
        withDescription(
          flowTestXml('F'),
          '[apex-mutation-testing pins=4] Checks &amp; rates'
        )
      )
    })

    it('Given a pinned test without description and a field sorting before it, When unpinned, Then the description is inserted in metadata order, after that field', () => {
      // Arrange
      const withActive = (xml: string) =>
        xml.replace(
          '    <flowApiName>',
          '    <active>true</active>\n    <flowApiName>'
        )
      const xml = withActive(flowTestXml('F', [1]))

      // Act & Assert
      expect(unpinFlowTest(xml)).toBe(
        withDescription(
          withActive(flowTestXml('F')),
          '[apex-mutation-testing pins=1]'
        )
      )
    })

    it('Given a pinned test with an empty description, When unpinned, Then the marker fills it', () => {
      // Arrange
      const xml = withDescription(flowTestXml('F', [2]), '')

      // Act & Assert
      expect(unpinFlowTest(xml)).toBe(
        withDescription(flowTestXml('F'), '[apex-mutation-testing pins=2]')
      )
    })
  })

  describe('leftoverPins', () => {
    it.each([
      ['no description', flowTestXml('F'), undefined],
      [
        'a description without the marker',
        flowTestXml('F').replace(
          '    <flowApiName>',
          '    <description>Checks [apex-mutation-testing]</description>\n    <flowApiName>'
        ),
        undefined,
      ],
      [
        'a marker without pins',
        flowTestXml('F').replace(
          '    <flowApiName>',
          '    <description>x [apex-mutation-testing pins=] y</description>\n    <flowApiName>'
        ),
        [],
      ],
      [
        'a marker inside the description',
        flowTestXml('F').replace(
          '    <flowApiName>',
          '    <description>before [apex-mutation-testing pins=7,12] after</description>\n    <flowApiName>'
        ),
        [7, 12],
      ],
    ])('Given %s, When read, Then the pins are %j', (_label, xml, expected) => {
      // Act & Assert
      expect(leftoverPins(xml)).toEqual(expected)
    })
  })
})
