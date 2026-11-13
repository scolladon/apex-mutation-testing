import { DecisionOperatorMutator } from '../../../../src/flow/mutators/DecisionOperatorMutator.js'
import { mutateBody } from '../../../utils/flowMutatorHarness.js'

const decision = (conditions: string, name = '<name>Is_Hot</name>') =>
  `    <decisions>
        ${name}
        <rules>
            ${conditions}
        </rules>
    </decisions>`

const condition = (
  operator: string,
  rightValue = '<numberValue>1.0</numberValue>'
) =>
  `<conditions>
                <leftValueReference>$Record.Rating</leftValueReference>
                <operator>${operator}</operator>
                <rightValue>${rightValue}</rightValue>
            </conditions>`

describe('DecisionOperatorMutator', () => {
  const sut = new DecisionOperatorMutator()

  it.each([
    ['EqualTo', 'NotEqualTo'],
    ['NotEqualTo', 'EqualTo'],
    ['GreaterThan', 'LessThanOrEqualTo'],
    ['LessThanOrEqualTo', 'GreaterThan'],
    ['LessThan', 'GreaterThanOrEqualTo'],
    ['GreaterThanOrEqualTo', 'LessThan'],
  ])(
    'Given a %s condition, When mutated, Then the operator becomes %s',
    (from, to) => {
      // Act
      const [result] = mutateBody(sut, decision(condition(from)))

      // Assert
      expect(result.xml).toContain(`<operator>${to}</operator>`)
      expect(result.mutation).toEqual({
        mutatorName: 'DecisionOperatorMutator',
        elementName: 'Is_Hot',
        description: `Inverted condition operator '${from}' to '${to}' in decision 'Is_Hot'`,
        edits: [expect.objectContaining({ replacement: to })],
      })
    }
  )

  it('Given an operator without an inversion, When mutated, Then no operator mutant is produced', () => {
    // Act & Assert
    expect(mutateBody(sut, decision(condition('Contains')))).toEqual([])
  })

  it.each([
    ['true', 'false'],
    ['FALSE', 'true'],
  ])(
    'Given a boolean right value %s, When mutated, Then it becomes %s',
    (from, to) => {
      // Act
      const results = mutateBody(
        sut,
        decision(condition('IsNull', `<booleanValue>${from}</booleanValue>`))
      )

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].xml).toContain(`<booleanValue>${to}</booleanValue>`)
      expect(results[0].mutation.description).toBe(
        `Inverted condition '$Record.Rating IsNull' from '${from.toLowerCase()}' to '${to}' in decision 'Is_Hot'`
      )
    }
  )

  it('Given an invertible operator and a boolean right value, When mutated, Then both mutants are produced', () => {
    // Act
    const results = mutateBody(
      sut,
      decision(condition('EqualTo', '<booleanValue>true</booleanValue>'))
    )

    // Assert
    expect(results.map(r => r.mutation.edits[0].replacement)).toEqual([
      'NotEqualTo',
      'false',
    ])
  })

  it('Given a non-boolean boolean value, When mutated, Then no boolean mutant is produced', () => {
    // Act & Assert
    expect(
      mutateBody(
        sut,
        decision(condition('IsNull', '<booleanValue>maybe</booleanValue>'))
      )
    ).toEqual([])
  })

  it('Given a condition without operator nor left reference, When its boolean is mutated, Then the description falls back', () => {
    // Act
    const [result] = mutateBody(
      sut,
      decision(
        '<conditions><rightValue><booleanValue>true</booleanValue></rightValue></conditions>'
      )
    )

    // Assert
    expect(result.mutation.description).toBe(
      "Inverted condition 'condition ' from 'true' to 'false' in decision 'Is_Hot'"
    )
  })

  it('Given an unnamed decision, When mutated, Then it is named by its position', () => {
    // Act
    const [result] = mutateBody(sut, decision(condition('EqualTo'), ''))

    // Assert
    expect(result.mutation.elementName).toBe('Decision_0')
  })

  it('Given no decision, When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(mutateBody(sut, '    <label>x</label>')).toEqual([])
  })
})
