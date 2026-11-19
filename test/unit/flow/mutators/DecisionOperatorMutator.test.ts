// cspell:ignore globalconstant
import { DecisionOperatorMutator } from '../../../../src/flow/mutators/DecisionOperatorMutator.js'
import { mutateBody } from '../../../utils/flowMutatorHarness.js'

const decision = (
  conditions: string,
  name = '<name>Is_Hot</name>',
  ruleName = '<name>Hot</name>'
) =>
  `    <decisions>
        ${name}
        <rules>
            ${ruleName}
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

const WHERE = "in rule 'Hot' of decision 'Is_Hot'"

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
    'Given a %s condition, When mutated, Then the operator becomes %s, anchored at the operator',
    (from, to) => {
      // Act
      const [result] = mutateBody(sut, decision(condition(from)))

      // Assert
      expect(result.xml).toContain(`<operator>${to}</operator>`)
      expect(result.mutation).toEqual({
        mutatorName: 'DecisionOperatorMutator',
        elementName: 'Is_Hot',
        description: `Inverted operator of '$Record.Rating' from '${from}' to '${to}' ${WHERE}`,
        edits: [expect.objectContaining({ replacement: to })],
        anchor: expect.any(Object),
        replacement: to,
      })
      const { start, end } = result.mutation.anchor
      expect(result.source.slice(start, end)).toBe(from)
    }
  )

  it('Given an operator without an inversion and a number, When mutated, Then no mutant is produced', () => {
    // Act & Assert
    expect(mutateBody(sut, decision(condition('Contains')))).toEqual([])
  })

  it.each([
    ['true', 'false'],
    ['FALSE', 'true'],
  ])(
    'Given an IsNull condition on boolean %s, When mutated, Then the boolean becomes %s',
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
        `Inverted '$Record.Rating IsNull' from '${from.toLowerCase()}' to '${to}' ${WHERE}`
      )
    }
  )

  it.each([
    ['$GlobalConstant.True', '$GlobalConstant.False', 'true', 'false'],
    ['$globalconstant.false', '$GlobalConstant.True', 'false', 'true'],
  ])(
    'Given an IsChanged condition on %s, When mutated, Then the reference becomes %s',
    (from, to, before, after) => {
      // Act
      const [result] = mutateBody(
        sut,
        decision(
          condition('IsChanged', `<elementReference>${from}</elementReference>`)
        )
      )

      // Assert
      expect(result.xml).toContain(`<elementReference>${to}</elementReference>`)
      expect(result.mutation.description).toBe(
        `Inverted '$Record.Rating IsChanged' from '${before}' to '${after}' ${WHERE}`
      )
      const { start, end } = result.mutation.anchor
      expect(result.source.slice(start, end)).toBe(from)
    }
  )

  it('Given an invertible operator compared with a boolean, When mutated, Then only the operator is inverted', () => {
    // Arrange — `NotEqualTo true` and `EqualTo false` are one change
    const body = decision(
      condition('EqualTo', '<booleanValue>true</booleanValue>')
    )

    // Act
    const results = mutateBody(sut, body)

    // Assert
    expect(results.map(r => r.mutation.replacement)).toEqual(['NotEqualTo'])
  })

  it.each([
    ['a non-boolean literal', '<booleanValue>maybe</booleanValue>'],
    [
      'a reference to another resource',
      '<elementReference>$Record.IsActive__c</elementReference>',
    ],
    ['no right value at all', ''],
  ])(
    'Given an IsNull condition on %s, When mutated, Then no mutant is produced',
    (_label, rightValue) => {
      // Act & Assert
      expect(
        mutateBody(sut, decision(condition('IsNull', rightValue)))
      ).toEqual([])
    }
  )

  it('Given a condition without operator nor left reference, When its boolean is mutated, Then the description falls back without a trailing space', () => {
    // Act
    const [result] = mutateBody(
      sut,
      decision(
        '<conditions><rightValue><booleanValue>true</booleanValue></rightValue></conditions>'
      )
    )

    // Assert
    expect(result.mutation.description).toBe(
      `Inverted 'condition' from 'true' to 'false' ${WHERE}`
    )
  })

  it('Given unnamed decisions and rules, When mutated, Then they are named by position and by default', () => {
    // Act
    const [result] = mutateBody(sut, decision(condition('EqualTo'), '', ''))

    // Assert
    expect(result.mutation.elementName).toBe('Decision_0')
    expect(result.mutation.description).toContain(
      "in rule 'Rule' of decision 'Decision_0'"
    )
  })

  it('Given two rules with conditions, When mutated, Then each mutant names its own rule', () => {
    // Arrange
    const body = `    <decisions>
        <name>Is_Hot</name>
        <rules>
            <name>Hot</name>
            ${condition('EqualTo')}
        </rules>
        <rules>
            <name>Warm</name>
            ${condition('LessThan')}
        </rules>
    </decisions>`

    // Act
    const results = mutateBody(sut, body)

    // Assert
    expect(results.map(r => r.mutation.description)).toEqual([
      "Inverted operator of '$Record.Rating' from 'EqualTo' to 'NotEqualTo' in rule 'Hot' of decision 'Is_Hot'",
      "Inverted operator of '$Record.Rating' from 'LessThan' to 'GreaterThanOrEqualTo' in rule 'Warm' of decision 'Is_Hot'",
    ])
  })

  it('Given conditions outside a decision rule, When mutated, Then they are not mutated', () => {
    // Arrange — record lookups have conditions-like filters, never rules
    const body = `    <recordLookups>
        <name>Find</name>
        <rules>
            ${condition('EqualTo')}
        </rules>
    </recordLookups>`

    // Act & Assert
    expect(mutateBody(sut, body)).toEqual([])
  })

  it('Given no decision, When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(mutateBody(sut, '    <label>x</label>')).toEqual([])
  })
})
