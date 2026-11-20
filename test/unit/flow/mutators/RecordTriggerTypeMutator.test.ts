import { RecordTriggerTypeMutator } from '../../../../src/flow/mutators/RecordTriggerTypeMutator.js'
import { mutateBody } from '../../../utils/flowMutatorHarness.js'

const start = (trigger: string) =>
  `    <start>\n        <recordTriggerType>${trigger}</recordTriggerType>\n    </start>`

const isChangedDecision = `    <decisions>
        <name>D</name>
        <rules>
            <conditions>
                <leftValueReference>$Record.Name</leftValueReference>
                <operator>IsChanged</operator>
                <rightValue><booleanValue>true</booleanValue></rightValue>
            </conditions>
        </rules>
    </decisions>`

describe('RecordTriggerTypeMutator', () => {
  const sut = new RecordTriggerTypeMutator()

  it.each([
    ['Create', ['Update']],
    ['Update', ['Create']],
    ['CreateAndUpdate', ['Create', 'Update']],
  ])(
    'Given a %s trigger, When mutated, Then it becomes each of %j, anchored at the trigger',
    (from, to) => {
      // Act
      const results = mutateBody(sut, start(from))

      // Assert
      expect(results.map(r => r.mutation.replacement)).toEqual(to)
      for (const [index, result] of results.entries()) {
        expect(result.xml).toContain(
          `<recordTriggerType>${to[index]}</recordTriggerType>`
        )
        expect(result.mutation).toMatchObject({
          mutatorName: 'RecordTriggerTypeMutator',
          elementName: '$Start',
          description: `Changed recordTriggerType from '${from}' to '${to[index]}'`,
        })
        const { start: at, end } = result.mutation.anchor
        expect(result.source.slice(at, end)).toBe(from)
      }
    }
  )

  it.each([
    ['Update', []],
    ['CreateAndUpdate', ['Update']],
    ['Create', ['Update']],
  ])(
    'Given a %s trigger and a flow using IsChanged, When mutated, Then no mutant makes it a Create flow',
    (from, to) => {
      // Arrange — the org refuses IsChanged in a flow triggered on Create
      const body = `${isChangedDecision}\n${start(from)}`

      // Act & Assert
      expect(mutateBody(sut, body).map(r => r.mutation.replacement)).toEqual(to)
    }
  )

  it('Given another operator than IsChanged, When mutated, Then Create stays a mutant', () => {
    // Act
    const body = `${isChangedDecision.replace('IsChanged', 'IsNull')}\n${start('Update')}`

    // Assert
    expect(mutateBody(sut, body).map(r => r.mutation.replacement)).toEqual([
      'Create',
    ])
  })

  it.each([
    ['an unknown trigger', start('Delete')],
    ['an empty trigger', start('')],
    [
      'no trigger',
      '    <start>\n        <object>Account</object>\n    </start>',
    ],
    ['no start', '    <label>x</label>'],
  ])('Given %s, When mutated, Then nothing is produced', (_label, body) => {
    // Act & Assert
    expect(mutateBody(sut, body)).toEqual([])
  })
})
