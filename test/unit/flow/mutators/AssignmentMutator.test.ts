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

  it('Given a non-boolean boolean value, When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(
      mutateBody(sut, assignment(item('<booleanValue>yes</booleanValue>')))
    ).toEqual([])
  })

  it.each([
    ['0', '1.0'],
    ['42.5', '0.0'],
    ['', '1.0'],
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
        `Changed numeric assignment '$Record.Rating' in 'Set_Rating' from '${from || '0'}' to '${to}'`
      )
    }
  )

  it('Given a number value that is not a number, When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(
      mutateBody(sut, assignment(item('<numberValue>abc</numberValue>')))
    ).toEqual([])
  })

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
