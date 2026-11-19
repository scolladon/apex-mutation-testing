import { FormulaExpressionMutator } from '../../../../src/flow/mutators/FormulaExpressionMutator.js'
import { mutateBody } from '../../../utils/flowMutatorHarness.js'

const formula = (expression: string, name = '<name>Rating_Label</name>') =>
  `    <formulas>
        ${expression}
        ${name}
    </formulas>`

const expression = (text: string) => formula(`<expression>${text}</expression>`)

// What each mutant reads as at its anchor in the source, and in its place.
const anchored = (results: ReturnType<typeof mutateBody>) =>
  results.map(({ mutation, source }) => [
    source.slice(mutation.anchor.start, mutation.anchor.end),
    mutation.replacement,
  ])

describe('FormulaExpressionMutator', () => {
  const sut = new FormulaExpressionMutator()

  it('Given a single-quoted literal, When mutated, Then it is emptied, anchored at the literal', () => {
    // Act
    const results = mutateBody(sut, expression("IF(x, 'Hot', y)"))

    // Assert
    expect(results.map(r => r.mutation.description)).toEqual([
      "Replaced string literal 'Hot' with '' in formula 'Rating_Label'",
    ])
    expect(results[0].xml).toContain("<expression>IF(x, '', y)</expression>")
    expect(anchored(results)).toEqual([["'Hot'", "''"]])
    expect(results[0].mutation).toMatchObject({
      mutatorName: 'FormulaExpressionMutator',
      elementName: 'Rating_Label',
    })
  })

  it('Given a double-quoted literal, When mutated, Then it is emptied with its own quotes', () => {
    // Act
    const results = mutateBody(sut, expression('IF(x, "Hot", y)'))

    // Assert
    expect(results[0].xml).toContain('<expression>IF(x, "", y)</expression>')
    expect(anchored(results)).toEqual([['"Hot"', '""']])
  })

  it('Given a literal with an escaped quote, When mutated, Then the literal is taken whole', () => {
    // Act
    const results = mutateBody(sut, expression("'it\\'s' = 'x'"))

    // Assert
    expect(anchored(results)).toEqual([
      ["'it\\'s'", "''"],
      ["'x'", "''"],
    ])
    expect(results[0].xml).toContain("<expression>'' = 'x'</expression>")
  })

  it('Given operators inside literals, When mutated, Then only the literals are mutated', () => {
    // Act
    const results = mutateBody(sut, expression('\'a&amp;&amp;b\' + "c||d"'))

    // Assert
    expect(results.map(r => r.mutation.description)).toEqual([
      "Replaced string literal 'a&&b' with '' in formula 'Rating_Label'",
      'Replaced string literal "c||d" with "" in formula \'Rating_Label\'',
    ])
  })

  it('Given a merge field holding a quote and an operator, When mutated, Then the merge field is skipped whole', () => {
    // Act
    const results = mutateBody(sut, expression("{!a'b == c} != 'z'"))

    // Assert
    expect(anchored(results)).toEqual([
      ['!=', '=='],
      ["'z'", "''"],
    ])
  })

  it('Given a merge field whose first character could close an operator, When mutated, Then the opening {! is never read as part of one', () => {
    // Act — the '!' of '{!' followed by '=' must not read as '!='
    const results = mutateBody(sut, expression("{!=x} || 'y'"))

    // Assert
    expect(anchored(results)).toEqual([
      ['||', '&amp;&amp;'],
      ["'y'", "''"],
    ])
  })

  it('Given a merge field ending in a quote, When mutated, Then the scan resumes right after its closing brace', () => {
    // Act — resuming one character early would open a literal at the quote
    const results = mutateBody(sut, expression("{!a'}'b'"))

    // Assert
    expect(anchored(results)).toEqual([["'b'", "''"]])
  })

  it('Given an unterminated merge field, When mutated, Then the scan stops at it', () => {
    // Act
    const results = mutateBody(sut, expression("'a' == {!x || 'b'"))

    // Assert
    expect(anchored(results)).toEqual([
      ["'a'", "''"],
      ['==', '!='],
    ])
  })

  it('Given an unterminated literal, When mutated, Then the scan stops at it', () => {
    // Act
    const results = mutateBody(sut, expression("a || 'b &amp;&amp; c"))

    // Assert
    expect(anchored(results)).toEqual([['||', '&amp;&amp;']])
  })

  it('Given an unterminated literal ending on a backslash, When mutated, Then the scan stops at it', () => {
    // Act & Assert
    expect(mutateBody(sut, expression("'abc\\"))).toEqual([])
  })

  it('Given an empty literal, When mutated, Then it is left alone', () => {
    // Act
    const results = mutateBody(sut, expression("'' == x"))

    // Assert
    expect(anchored(results)).toEqual([['==', '!=']])
  })

  it.each([
    ['&amp;&amp;', '||', 'a || b'],
    ['||', '&amp;&amp;', 'a &amp;&amp; b'],
    ['==', '!=', 'a != b'],
    ['!=', '==', 'a == b'],
  ])(
    'Given the operator %s, When mutated, Then it becomes %s, anchored at its escaped spelling',
    (from, to, deployed) => {
      // Act
      const results = mutateBody(sut, expression(`a ${from} b`))

      // Assert
      expect(anchored(results)).toEqual([[from, to]])
      expect(results[0].xml).toContain(`<expression>${deployed}</expression>`)
    }
  )

  it('Given an operator repeated, When mutated, Then each occurrence is its own mutant and names its rank', () => {
    // Act
    const results = mutateBody(sut, expression('a == b &amp;&amp; c == d'))

    // Assert
    expect(results.map(r => r.mutation.description)).toEqual([
      "Replaced operator '==' with '!=' (occurrence 1 of 2) in formula 'Rating_Label'",
      "Replaced operator '&&' with '||' in formula 'Rating_Label'",
      "Replaced operator '==' with '!=' (occurrence 2 of 2) in formula 'Rating_Label'",
    ])
    expect(results[2].xml).toContain(
      '<expression>a == b &amp;&amp; c != d</expression>'
    )
  })

  it('Given operators spelled with numeric entities, When mutated, Then the anchor spans the entities', () => {
    // Act
    const results = mutateBody(sut, expression('a &#38;&#x26; b'))

    // Assert
    expect(anchored(results)).toEqual([['&#38;&#x26;', '||']])
  })

  it('Given a literal holding a character outside the BMP, When mutated, Then the anchors after it are exact', () => {
    // Act
    const results = mutateBody(sut, expression("'&#x1F600;' || b"))

    // Assert
    expect(anchored(results)).toEqual([
      ["'&#x1F600;'", "''"],
      ['||', '&amp;&amp;'],
    ])
  })

  it('Given an expression in CDATA across CRLF lines, When mutated, Then the anchor is the operator in the source', () => {
    // Act
    const results = mutateBody(sut, expression('<![CDATA[a\r\n&& b]]>'))

    // Assert
    expect(anchored(results)).toEqual([['&&', '||']])
    expect(results[0].xml).toContain('<expression>a\n|| b</expression>')
  })

  it('Given surrounding whitespace in the expression, When mutated, Then it reaches the org unchanged', () => {
    // Act
    const [result] = mutateBody(sut, expression('\n  a || b\n'))

    // Assert
    expect(result.xml).toContain(
      '<expression>\n  a &amp;&amp; b\n</expression>'
    )
  })

  it('Given an expression its text cannot be mapped back to (a comment inside), When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(mutateBody(sut, expression("a || <!-- note --> 'x'"))).toEqual([])
  })

  it.each([
    ['no expression', formula('')],
    ['an empty expression', expression('')],
    ['a self-closing expression', formula('<expression/>')],
    ['no literal nor operator', expression('UPPER(x)')],
  ])('Given %s, When mutated, Then nothing is produced', (_label, body) => {
    // Act & Assert
    expect(mutateBody(sut, body)).toEqual([])
  })

  it('Given an unnamed formula, When mutated, Then it is named by its position', () => {
    // Act
    const [result] = mutateBody(
      sut,
      formula('<expression>a || b</expression>', '')
    )

    // Assert
    expect(result.mutation.elementName).toBe('Formula_0')
  })
})
