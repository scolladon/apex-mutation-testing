import { AssignmentMutator } from '../../../../src/flow/mutators/AssignmentMutator.js'
import { mutateBody } from '../../../utils/flowMutatorHarness.js'

const assignment = (items: string, name = '<name>Set_Rating</name>') =>
  `    <assignments>
        ${name}
        ${items}
    </assignments>`

const item = (
  value: string,
  operator = 'Assign',
  reference = '<assignToReference>$Record.Rating</assignToReference>'
) =>
  `<assignmentItems>
            ${reference}
            <operator>${operator}</operator>
            <value>${value}</value>
        </assignmentItems>`

describe('AssignmentMutator', () => {
  const sut = new AssignmentMutator()

  it('Given a non-empty string value, When mutated, Then it is emptied', () => {
    // Act
    const [result] = mutateBody(
      sut,
      assignment(item('<stringValue>Hot</stringValue>'))
    )

    // Assert
    expect(result.xml).toContain('<stringValue></stringValue>')
    expect(result.mutation).toMatchObject({
      mutatorName: 'AssignmentMutator',
      elementName: 'Set_Rating',
      description:
        "Changed assignment '$Record.Rating' in 'Set_Rating' from 'Hot' to ''",
    })
  })

  it('Given an empty string value, When mutated, Then it is filled', () => {
    // Act
    const [result] = mutateBody(sut, assignment(item('<stringValue/>')))

    // Assert
    expect(result.xml).toContain('<stringValue>MUTATED</stringValue>')
  })

  it.each([
    ['true', 'false'],
    ['False', 'true'],
  ])(
    'Given a boolean value %s, When mutated, Then it becomes %s',
    (from, to) => {
      // Act
      const [result] = mutateBody(
        sut,
        assignment(item(`<booleanValue>${from}</booleanValue>`))
      )

      // Assert
      expect(result.xml).toContain(`<booleanValue>${to}</booleanValue>`)
      expect(result.mutation.description).toBe(
        `Inverted boolean assignment '$Record.Rating' in 'Set_Rating' from '${from.toLowerCase()}' to '${to}'`
      )
    }
  )

  it.each([
    ['$GlobalConstant.True', '$GlobalConstant.False', 'true', 'false'],
    ['$GlobalConstant.False', '$GlobalConstant.True', 'false', 'true'],
  ])(
    'Given a boolean reference %s, When mutated, Then it becomes %s',
    (from, to, before, after) => {
      // Act
      const [result] = mutateBody(
        sut,
        assignment(item(`<elementReference>${from}</elementReference>`))
      )

      // Assert
      expect(result.xml).toContain(`<elementReference>${to}</elementReference>`)
      expect(result.mutation.description).toBe(
        `Inverted boolean assignment '$Record.Rating' in 'Set_Rating' from '${before}' to '${after}'`
      )
      const { start, end } = result.mutation.anchor
      expect(result.source.slice(start, end)).toBe(from)
      expect(result.mutation.replacement).toBe(to)
    }
  )

  it('Given a non-boolean boolean value, When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(
      mutateBody(sut, assignment(item('<booleanValue>yes</booleanValue>')))
    ).toEqual([])
  })

  it.each([
    ['0', '1.0'],
    ['42.5', '0.0'],
  ])(
    'Given a number value "%s", When mutated, Then it becomes %s',
    (from, to) => {
      // Act
      const [result] = mutateBody(
        sut,
        assignment(item(`<numberValue>${from}</numberValue>`))
      )

      // Assert
      expect(result.xml).toContain(`<numberValue>${to}</numberValue>`)
      expect(result.mutation.description).toBe(
        `Changed numeric assignment '$Record.Rating' in 'Set_Rating' from '${from}' to '${to}'`
      )
    }
  )

  it.each([
    ['<numberValue>abc</numberValue>'],
    ['<numberValue></numberValue>'],
    ['<numberValue/>'],
  ])(
    'Given the number value %s, When mutated, Then nothing is produced',
    value => {
      // Act & Assert
      expect(mutateBody(sut, assignment(item(value)))).toEqual([])
    }
  )

  it.each([
    ['Add', 'Subtract'],
    ['Subtract', 'Add'],
  ])('Given the %s operator, When mutated, Then it becomes %s', (from, to) => {
    // Act
    const results = mutateBody(
      sut,
      assignment(item('<elementReference>x</elementReference>', from))
    )

    // Assert
    expect(results).toHaveLength(1)
    expect(results[0].xml).toContain(`<operator>${to}</operator>`)
    expect(results[0].mutation.description).toBe(
      `Changed assignment operator '${from}' to '${to}' for '$Record.Rating' in 'Set_Rating'`
    )
  })

  const variable = (dataType: string, isCollection = false) =>
    `    <variables>
        <name>total</name>
        <dataType>${dataType}</dataType>
        <isCollection>${isCollection}</isCollection>
    </variables>`

  const targetItem = (value: string, operator = 'Add') =>
    item(value, operator, '<assignToReference>total</assignToReference>')

  it.each([
    ['a text literal', '', '<stringValue>x</stringValue>'],
    [
      'a String target',
      variable('String'),
      '<elementReference>a</elementReference>',
    ],
    [
      'a Picklist target',
      variable('Picklist'),
      '<elementReference>a</elementReference>',
    ],
    [
      'a Multipicklist target',
      variable('Multipicklist'),
      '<elementReference>a</elementReference>',
    ],
    [
      'a collection target',
      variable('Number', true),
      '<elementReference>a</elementReference>',
    ],
    ['an Add of zero', '', '<numberValue>0</numberValue>'],
    ['an Add of 0.0', '', '<numberValue>0.0</numberValue>'],
  ])(
    'Given %s, When mutated, Then Add is not swapped for Subtract',
    (_label, variables, value) => {
      // Act
      const results = mutateBody(
        sut,
        `${variables}\n${assignment(targetItem(value))}`
      )

      // Assert
      expect(results.map(r => r.mutation.replacement)).not.toContain('Subtract')
    }
  )

  it.each([
    ['a Number target', variable('Number')],
    ['a Currency target, not a collection', variable('Currency', false)],
    ['an undeclared target', ''],
  ])(
    'Given %s added to by a reference, When mutated, Then Add becomes Subtract',
    (_label, variables) => {
      // Act
      const results = mutateBody(
        sut,
        `${variables}\n${assignment(targetItem('<elementReference>a</elementReference>'))}`
      )

      // Assert
      expect(results.map(r => r.mutation.replacement)).toEqual(['Subtract'])
    }
  )

  it('Given a Number target added to by a non-zero number, When mutated, Then Add becomes Subtract', () => {
    // Act
    const results = mutateBody(
      sut,
      `${variable('Number')}\n${assignment(targetItem('<numberValue>2</numberValue>'))}`
    )

    // Assert
    expect(results.map(r => r.mutation.replacement)).toEqual([
      '0.0',
      'Subtract',
    ])
  })

  it('Given an operator nested below a value rather than on the item, When mutated, Then it is not taken for the item operator', () => {
    // Act
    const results = mutateBody(
      sut,
      assignment(
        '<assignmentItems><assignToReference>x</assignToReference><value><operator>Add</operator></value></assignmentItems>'
      )
    )

    // Assert
    expect(results).toEqual([])
  })

  it('Given an item with a value and a swappable operator, When mutated, Then both mutants are produced in order', () => {
    // Act
    const results = mutateBody(
      sut,
      assignment(item('<numberValue>1</numberValue>', 'Add'))
    )

    // Assert
    expect(results.map(r => r.mutation.edits[0].replacement)).toEqual([
      '0.0',
      'Subtract',
    ])
  })

  it('Given an unnamed assignment and an item without reference, When mutated, Then both are named by position', () => {
    // Act
    const [result] = mutateBody(
      sut,
      assignment(item('<stringValue>a</stringValue>', 'Assign', ''), '')
    )

    // Assert
    expect(result.mutation.elementName).toBe('Assignment_0')
    expect(result.mutation.description).toContain("'Item_0'")
  })

  it('Given an item without value nor operator, When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(
      mutateBody(sut, assignment('<assignmentItems></assignmentItems>'))
    ).toEqual([])
  })
})
