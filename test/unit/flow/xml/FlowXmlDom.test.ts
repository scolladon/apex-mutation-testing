import {
  applyEdits,
  escapeXmlText,
  FlowXmlDom,
  SF_NAMESPACE,
} from '../../../../src/flow/xml/FlowXmlDom.js'

const doc = (body: string, root = 'Flow') =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<${root} xmlns="${SF_NAMESPACE}">\n${body}\n</${root}>\n`

describe('FlowXmlDom', () => {
  describe('parse', () => {
    it('Given malformed XML, When parsed, Then it throws an XML parsing error', () => {
      // Act & Assert
      expect(() => FlowXmlDom.parse('<Flow><a></Flow>')).toThrow(
        /XML parsing failed/
      )
    })

    it('Given text without a root element, When parsed, Then it throws', () => {
      // Act & Assert
      expect(() => FlowXmlDom.parse('')).toThrow(/XML parsing failed/)
    })

    it('Given a recoverable parser error such as an undefined entity, When parsed, Then it throws that error', () => {
      // Act & Assert
      expect(() => FlowXmlDom.parse(doc('    <a>&bogus;</a>'))).toThrow(
        'XML parsing failed: entity not found:&bogus;'
      )
    })

    it('Given a well-formed document that only triggers a parser warning, When parsed, Then it still parses', () => {
      // Arrange — an unbound prefix declaration-free attribute is a warning
      const xml = doc('    <name>a</name>').replace(
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?xml version="1.0" encoding="UTF-8"?><!-- c -->'
      )

      // Act
      const sut = FlowXmlDom.parse(xml)

      // Assert
      expect(sut.childText(sut.root, 'name')).toBe('a')
    })
  })

  describe('isRoot', () => {
    it('Given a Flow in the metadata namespace, When asked for Flow, Then it answers true', () => {
      // Arrange
      const sut = FlowXmlDom.parse(doc(''))

      // Act & Assert
      expect(sut.isRoot('Flow')).toBe(true)
      expect(sut.isRoot('FlowTest')).toBe(false)
    })

    it('Given a Flow outside the metadata namespace, When asked for Flow, Then it answers false', () => {
      // Arrange
      const sut = FlowXmlDom.parse('<Flow><status>Draft</status></Flow>')

      // Act & Assert
      expect(sut.isRoot('Flow')).toBe(false)
    })
  })

  describe('queries', () => {
    const xml = doc(`    <decisions>
        <name>D1</name>
        <rules>
            <name>R1</name>
        </rules>
    </decisions>
    <other xmlns="urn:other"><name>foreign</name></other>
    <name>  Top  </name>
    <empty></empty>`)

    it('Given nested elements, When listing by name, Then every descendant in the metadata namespace is returned in document order', () => {
      // Arrange
      const sut = FlowXmlDom.parse(xml)

      // Act
      const names = sut.elements('name').map(element => sut.text(element))

      // Assert
      expect(names).toEqual(['D1', 'R1', 'Top'])
    })

    it('Given a scope, When listing by name, Then only descendants of the scope are returned', () => {
      // Arrange
      const sut = FlowXmlDom.parse(xml)
      const rules = sut.elements('rules')[0]

      // Act & Assert
      expect(sut.elements('name', rules).map(e => sut.text(e))).toEqual(['R1'])
    })

    it('Given direct children, When reading children, Then only direct children in the namespace match', () => {
      // Arrange
      const sut = FlowXmlDom.parse(xml)

      // Act & Assert
      expect(sut.children(sut.root, 'name')).toHaveLength(1)
      expect(sut.childText(sut.root, 'name')).toBe('Top')
      expect(sut.child(sut.root, 'missing')).toBeUndefined()
    })

    it('Given an empty or missing element, When reading its text, Then it is undefined', () => {
      // Arrange
      const sut = FlowXmlDom.parse(xml)

      // Act & Assert
      expect(sut.childText(sut.root, 'empty')).toBeUndefined()
      expect(sut.text(undefined)).toBeUndefined()
    })
  })

  describe('positionAt', () => {
    it('Given offsets on several lines, When converted, Then lines and columns are 1-based', () => {
      // Arrange
      const sut = FlowXmlDom.parse(doc('    <name>a</name>'))
      const offset = sut.source.indexOf('<name>')

      // Act & Assert
      expect(sut.positionAt(0)).toEqual({ line: 1, column: 1 })
      expect(sut.positionAt(offset)).toEqual({ line: 3, column: 5 })
      expect(sut.positionAt(sut.source.length - 2)).toEqual({
        line: 4,
        column: 7,
      })
    })
  })

  describe('replaceTextEdit', () => {
    it('Given a leaf element, When its text is replaced, Then only the text between the tags changes and the new text is escaped', () => {
      // Arrange
      const xml = doc('    <expression>a &amp;&amp; b</expression>')
      const sut = FlowXmlDom.parse(xml)
      const expression = sut.child(sut.root, 'expression')!

      // Act
      const edit = sut.replaceTextEdit(expression, 'a || <b>')

      // Assert
      expect(applyEdits(xml, [edit])).toBe(
        doc('    <expression>a || &lt;b&gt;</expression>')
      )
      expect(xml.slice(edit.start, edit.end)).toBe('a &amp;&amp; b')
    })

    it('Given an element with no text, When its text is replaced, Then the text is inserted between the tags', () => {
      // Arrange
      const xml = doc('    <stringValue></stringValue>')
      const sut = FlowXmlDom.parse(xml)

      // Act
      const edit = sut.replaceTextEdit(sut.child(sut.root, 'stringValue')!, 'X')

      // Assert
      expect(applyEdits(xml, [edit])).toBe(
        doc('    <stringValue>X</stringValue>')
      )
    })

    it('Given a self-closing element, When its text is replaced, Then it is rewritten with an explicit close tag', () => {
      // Arrange
      const xml = doc('    <stringValue/>')
      const sut = FlowXmlDom.parse(xml)

      // Act
      const edit = sut.replaceTextEdit(sut.child(sut.root, 'stringValue')!, 'X')

      // Assert
      expect(applyEdits(xml, [edit])).toBe(
        doc('    <stringValue>X</stringValue>')
      )
    })

    it('Given an element with element children, When its text is replaced, Then it refuses', () => {
      // Arrange
      const sut = FlowXmlDom.parse(doc('    <value><a>1</a></value>'))

      // Act & Assert
      expect(() =>
        sut.replaceTextEdit(sut.child(sut.root, 'value')!, 'x')
      ).toThrow('<value> is not a leaf element')
    })

    it('Given text spanning lines, When replaced, Then the edit covers all of it', () => {
      // Arrange
      const xml = doc('    <expression>a\n  b</expression>')
      const sut = FlowXmlDom.parse(xml)

      // Act
      const edit = sut.replaceTextEdit(sut.child(sut.root, 'expression')!, 'c')

      // Assert
      expect(applyEdits(xml, [edit])).toBe(
        doc('    <expression>c</expression>')
      )
    })
  })

  describe('removeElementEdit', () => {
    it('Given an element alone on its lines, When removed, Then its lines are removed with it', () => {
      // Arrange
      const xml = doc(`    <rules>
        <connector>
            <targetReference>A</targetReference>
        </connector>
        <name>R</name>
    </rules>`)
      const sut = FlowXmlDom.parse(xml)

      // Act
      const edit = sut.removeElementEdit(sut.elements('connector')[0])

      // Assert
      expect(applyEdits(xml, [edit])).toBe(
        doc(`    <rules>
        <name>R</name>
    </rules>`)
      )
    })

    it('Given an element sharing its line, When removed, Then only the element is removed', () => {
      // Arrange
      const xml = doc('    <a><b>1</b><c>2</c></a>')
      const sut = FlowXmlDom.parse(xml)

      // Act
      const edit = sut.removeElementEdit(sut.elements('b')[0])

      // Assert
      expect(applyEdits(xml, [edit])).toBe(doc('    <a><c>2</c></a>'))
    })

    it('Given an element followed by text on its line, When removed, Then the line is kept', () => {
      // Arrange
      const xml = doc('    <b>1</b> tail')
      const sut = FlowXmlDom.parse(xml)

      // Act
      const edit = sut.removeElementEdit(sut.child(sut.root, 'b')!)

      // Assert
      expect(applyEdits(xml, [edit])).toBe(doc('     tail'))
    })

    it('Given the last element of a document without a trailing newline, When removed, Then only the element is removed', () => {
      // Arrange
      const xml = `<Flow xmlns="${SF_NAMESPACE}"><b>1</b></Flow>`
      const sut = FlowXmlDom.parse(xml)

      // Act
      const edit = sut.removeElementEdit(sut.root)

      // Assert
      expect(applyEdits(xml, [edit])).toBe('')
    })

    it('Given nested elements of the same name, When the outer one is removed, Then the matching close tag is found', () => {
      // Arrange
      const xml = doc(
        '    <x><x>1</x><x/><xy>2</xy></x>\n    <name>keep</name>'
      )
      const sut = FlowXmlDom.parse(xml)

      // Act
      const edit = sut.removeElementEdit(sut.child(sut.root, 'x')!)

      // Assert
      expect(applyEdits(xml, [edit])).toBe(doc('    <name>keep</name>'))
    })

    it('Given a self-closing element, When removed, Then it is removed', () => {
      // Arrange
      const xml = doc('    <b/>\n    <name>keep</name>')
      const sut = FlowXmlDom.parse(xml)

      // Act
      const edit = sut.removeElementEdit(sut.child(sut.root, 'b')!)

      // Assert
      expect(applyEdits(xml, [edit])).toBe(doc('    <name>keep</name>'))
    })
  })

  describe('insertChildEdit', () => {
    it('Given a later sibling, When a child is inserted, Then it lands before the first sibling sorting after it, with its indentation', () => {
      // Arrange
      const xml = doc(
        '    <apiVersion>66.0</apiVersion>\n    <status>Active</status>'
      )
      const sut = FlowXmlDom.parse(xml)

      // Act
      const edit = sut.insertChildEdit(
        sut.root,
        'description',
        '<description>d</description>'
      )

      // Assert
      expect(applyEdits(xml, [edit])).toBe(
        doc(
          '    <apiVersion>66.0</apiVersion>\n    <description>d</description>\n    <status>Active</status>'
        )
      )
    })

    it('Given no sibling sorting after it, When a child is inserted, Then it lands before the parent close tag', () => {
      // Arrange
      const xml = doc('    <apiVersion>66.0</apiVersion>')
      const sut = FlowXmlDom.parse(xml)

      // Act
      const edit = sut.insertChildEdit(
        sut.root,
        'status',
        '<status>Draft</status>'
      )

      // Assert
      expect(applyEdits(xml, [edit])).toBe(
        doc('    <apiVersion>66.0</apiVersion>\n    <status>Draft</status>')
      )
    })
  })

  describe('applyEdits', () => {
    it('Given edits in any order, When applied, Then each applies against the original offsets', () => {
      // Act
      const sut = applyEdits('abcdef', [
        { start: 0, end: 1, replacement: 'X' },
        { start: 4, end: 6, replacement: 'YZ!' },
        { start: 2, end: 2, replacement: '_' },
      ])

      // Assert
      expect(sut).toBe('Xb_cdYZ!')
    })

    it('Given overlapping edits, When applied, Then it refuses', () => {
      // Act & Assert
      expect(() =>
        applyEdits('abcdef', [
          { start: 0, end: 3, replacement: '' },
          { start: 2, end: 4, replacement: '' },
        ])
      ).toThrow('Overlapping XML edits cannot be applied together')
    })

    it('Given no edit, When applied, Then the source is unchanged', () => {
      // Act & Assert
      expect(applyEdits('abc', [])).toBe('abc')
    })
  })

  describe('escapeXmlText', () => {
    it('Given markup characters, When escaped, Then &, < and > are escaped', () => {
      // Act & Assert
      expect(escapeXmlText(`a & <b> 'c' "d"`)).toBe(`a &amp; &lt;b&gt; 'c' "d"`)
    })
  })

  describe('CRLF sources', () => {
    it('Given a CRLF document, When a text is replaced, Then the offsets still address the right characters', () => {
      // Arrange
      const xml = doc('    <a>1</a>\n    <b>2</b>').replace(/\n/g, '\r\n')
      const sut = FlowXmlDom.parse(xml)

      // Act
      const edit = sut.replaceTextEdit(sut.child(sut.root, 'b')!, '3')

      // Assert
      expect(applyEdits(xml, [edit])).toBe(
        doc('    <a>1</a>\n    <b>3</b>').replace(/\n/g, '\r\n')
      )
    })
  })

  describe('round-4 behaviour', () => {
    it('Given an unquoted attribute, a parser warning, When parsed, Then it still parses', () => {
      // Arrange — xmldom reports a missing quote as a warning, not an error
      const xml = `<Flow xmlns="${SF_NAMESPACE}" x=1><name>a</name></Flow>`

      // Act
      const sut = FlowXmlDom.parse(xml)

      // Assert
      expect(sut.childText(sut.root, 'name')).toBe('a')
    })

    it('Given a child of the same name in another namespace, When reading children, Then only the metadata one matches', () => {
      // Arrange
      const sut = FlowXmlDom.parse(
        doc(
          '    <value>a</value>\n    <x:value xmlns:x="urn:other">b</x:value>'
        )
      )

      // Act & Assert
      expect(sut.children(sut.root, 'value').map(v => sut.text(v))).toEqual([
        'a',
      ])
    })

    it('Given an offset exactly at the start of a line, When converted, Then it is column 1 of that line', () => {
      // Arrange
      const sut = FlowXmlDom.parse('<a>\n<b/>\n</a>')

      // Act & Assert
      expect(sut.positionAt(4)).toEqual({ line: 2, column: 1 })
      expect(sut.positionAt(3)).toEqual({ line: 1, column: 4 })
      expect(sut.positionAt(9)).toEqual({ line: 3, column: 1 })
    })

    it('Given an element whose name holds a regular-expression character, When removed, Then its own close tag is found', () => {
      // Arrange — "a.b" read as a pattern would also match <aXb>
      const sut = FlowXmlDom.parse(
        `<Flow xmlns="${SF_NAMESPACE}"><a.b><aXb>1</aXb></a.b><c/></Flow>`
      )

      // Act
      const edit = sut.removeElementEdit(sut.elements('a.b')[0])

      // Assert
      expect(applyEdits(sut.source, [edit])).toBe(
        `<Flow xmlns="${SF_NAMESPACE}"><c/></Flow>`
      )
    })

    it('Given a sibling of the same name, When a child is inserted, Then it lands after it, before the next name', () => {
      // Arrange
      const sut = FlowXmlDom.parse(doc('    <b>1</b>\n    <c>2</c>'))

      // Act
      const edit = sut.insertChildEdit(sut.root, 'b', '<b>0</b>')

      // Assert
      expect(applyEdits(sut.source, [edit])).toBe(
        doc('    <b>1</b>\n    <b>0</b>\n    <c>2</c>')
      )
    })

    it('Given a parent closed right before its own parent, When a child is appended, Then it lands inside the parent', () => {
      // Arrange
      const sut = FlowXmlDom.parse(
        `<Flow xmlns="${SF_NAMESPACE}"><p><a/></p></Flow>`
      )

      // Act
      const edit = sut.insertChildEdit(sut.elements('p')[0], 'z', '<z/>')

      // Assert
      expect(applyEdits(sut.source, [edit])).toBe(
        `<Flow xmlns="${SF_NAMESPACE}"><p><a/>    <z/>\n</p></Flow>`
      )
    })

    it('Given an element preceded by text on its line, When removed, Then the line is kept', () => {
      // Arrange
      const sut = FlowXmlDom.parse(doc('x <b>1</b>\n    <c/>'))

      // Act
      const edit = sut.removeElementEdit(sut.child(sut.root, 'b')!)

      // Assert
      expect(applyEdits(sut.source, [edit])).toBe(doc('x \n    <c/>'))
    })

    it('Given an element followed only by spaces on its line, When removed, Then its whole line goes', () => {
      // Arrange
      const sut = FlowXmlDom.parse(doc('    <b>1</b>   \n    <c/>'))

      // Act
      const edit = sut.removeElementEdit(sut.child(sut.root, 'b')!)

      // Assert
      expect(applyEdits(sut.source, [edit])).toBe(doc('    <c/>'))
    })

    it.each([
      ['a comment', '<!-- <a> --><b>x</b><!-- </a> -->'],
      ['a CDATA section', '<b><![CDATA[<a></a> </a>]]></b>'],
    ])(
      'Given %s spelling the tag inside the element, When asked for its span, Then the real close tag ends it',
      (_label, inner) => {
        // Arrange
        const source = doc(`    <a>${inner}</a>\n    <c/>`)
        const dom = FlowXmlDom.parse(source)
        const [a] = dom.elements('a')

        // Act
        const { start, end } = dom.spanOf(a)

        // Assert
        expect(source.slice(start, end)).toBe(`<a>${inner}</a>`)
      }
    )

    it('Given a self-closing element, When its text offsets are read, Then the one offset is where it ends', () => {
      // Arrange
      const source = doc('    <b>xy</b>\n    <a/>')
      const dom = FlowXmlDom.parse(source)
      const [a] = dom.elements('a')

      // Act & Assert
      expect(dom.textOffsets(a)).toEqual([source.indexOf('<a/>') + 4])
    })

    it('Given elements, When asked for their span, Then it runs from the open tag to one past the close tag', () => {
      // Arrange
      const sut = FlowXmlDom.parse(doc('    <b><c/></b>\n    <d/>'))

      // Act
      const spans = ['b', 'c', 'd'].map(name => {
        const { start, end } = sut.spanOf(sut.elements(name)[0])
        return sut.source.slice(start, end)
      })

      // Assert
      expect(spans).toEqual(['<b><c/></b>', '<c/>', '<d/>'])
    })

    describe('textOffsets', () => {
      const offsetsOf = (body: string) => {
        const sut = FlowXmlDom.parse(doc(body))
        const element = sut.elements('e')[0]
        const offsets = sut.textOffsets(element)
        return { sut, element, offsets }
      }

      it('Given plain text, When mapped, Then each character maps to its own offset and one entry follows the last', () => {
        // Act
        const { sut, offsets } = offsetsOf('<e>ab</e>')

        // Assert
        expect(offsets?.map(at => sut.source[at])).toEqual(['a', 'b', '<'])
      })

      it('Given named and numeric entities, When mapped, Then each character maps to the start of its entity', () => {
        // Act
        const { sut, element, offsets } = offsetsOf(
          '<e>&amp;&lt;&gt;&quot;&apos;&#65;&#x42;c</e>'
        )

        // Assert
        expect(element.textContent).toBe('&<>"\'ABc')
        expect(offsets?.map(at => sut.source.slice(at, at + 2))).toEqual([
          '&a',
          '&l',
          '&g',
          '&q',
          '&a',
          '&#',
          '&#',
          'c<',
          '</',
        ])
      })

      it('Given a character outside the BMP, When mapped, Then both of its code units map to its entity', () => {
        // Act
        const { offsets } = offsetsOf('<e>&#x1F600;z</e>')

        // Assert
        expect(offsets?.length).toBe(4)
        expect(offsets?.[0]).toBe(offsets?.[1])
        expect((offsets?.[2] ?? 0) - (offsets?.[1] ?? 0)).toBe(
          '&#x1F600;'.length
        )
      })

      it('Given CDATA and CRLF line ends, When mapped, Then markers are skipped and a CRLF is one character', () => {
        // Act
        const { sut, element, offsets } = offsetsOf(
          '<e>a\r\nb<![CDATA[<c\r\nd>]]>e</e>'
        )

        // Assert
        expect(element.textContent).toBe('a\nb<c\nd>e')
        expect(offsets?.map(at => sut.source[at])).toEqual([
          'a',
          '\r',
          'b',
          '<',
          'c',
          '\r',
          'd',
          '>',
          'e',
          '<',
        ])
      })

      it('Given text the element spells with a comment inside, When mapped, Then it cannot be mapped character by character', () => {
        // Act & Assert
        expect(offsetsOf('<e>a<!-- x -->b</e>').offsets).toBeUndefined()
      })

      it('Given an empty element, When mapped, Then only the end entry is left', () => {
        // Act
        const { sut, offsets } = offsetsOf('<e></e>')

        // Assert
        expect(offsets).toHaveLength(1)
        expect(sut.source.slice(offsets?.[0])).toMatch(/^<\/e>/)
      })
    })
  })
})
