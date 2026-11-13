import { FormulaExpressionMutator } from '../../../../src/flow/mutators/FormulaExpressionMutator.js'
import { mutateBody } from '../../../utils/flowMutatorHarness.js'

const formula = (expression: string, name = '<name>Rating_Label</name>') =>
  `    <formulas>
        ${expression}
        ${name}
    </formulas>`

describe('FormulaExpressionMutator', () => {
  const sut = new FormulaExpressionMutator()

  it('Given string literals, When mutated, Then each literal is emptied in its own mutant', () => {
    // Act
    const results = mutateBody(
      sut,
      formula("<expression>IF(x, 'Hot', 'Cold')</expression>")
    )

    // Assert
    expect(results.map(r => r.mutation.edits[0].replacement)).toEqual([
      "IF(x, '', 'Cold')",
      "IF(x, 'Hot', '')",
    ])
    expect(results[0].mutation).toMatchObject({
      mutatorName: 'FormulaExpressionMutator',
      elementName: 'Rating_Label',
      description:
        "Replaced string literal 'Hot' with '' in formula 'Rating_Label'",
    })
  })

  it('Given escaped operators, When mutated, Then each occurrence is swapped and re-escaped in the deployed XML', () => {
    // Act
    const results = mutateBody(
      sut,
      formula(
        '<expression>a &amp;&amp; b &amp;&amp; c || d == e != f</expression>'
      )
    )

    // Assert
    expect(results.map(r => r.mutation.description)).toEqual([
      "Replaced operator '&&' with '||' in formula 'Rating_Label'",
      "Replaced operator '&&' with '||' in formula 'Rating_Label'",
      "Replaced operator '||' with '&&' in formula 'Rating_Label'",
      "Replaced operator '==' with '!=' in formula 'Rating_Label'",
      "Replaced operator '!=' with '==' in formula 'Rating_Label'",
    ])
    expect(results[1].xml).toContain(
      '<expression>a &amp;&amp; b || c || d == e != f</expression>'
    )
  })

  it('Given an empty or missing expression, When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(mutateBody(sut, formula('<expression></expression>'))).toEqual([])
    expect(mutateBody(sut, formula(''))).toEqual([])
  })

  it('Given an expression without literal nor operator, When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(
      mutateBody(sut, formula('<expression>TODAY()</expression>'))
    ).toEqual([])
  })

  it('Given an unnamed formula, When mutated, Then it is named by its position', () => {
    // Act
    const [result] = mutateBody(
      sut,
      formula("<expression>'a'</expression>", '')
    )

    // Assert
    expect(result.mutation.elementName).toBe('Formula_0')
  })
})
