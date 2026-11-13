import { RecordTriggerTypeMutator } from '../../../../src/flow/mutators/RecordTriggerTypeMutator.js'
import { mutateBody } from '../../../utils/flowMutatorHarness.js'

const start = (trigger: string) =>
  `    <start>\n        <recordTriggerType>${trigger}</recordTriggerType>\n    </start>`

describe('RecordTriggerTypeMutator', () => {
  const sut = new RecordTriggerTypeMutator()

  it.each([
    ['Create', ['Update']],
    ['Update', ['Create']],
    ['CreateAndUpdate', ['Create', 'Update']],
  ])(
    'Given a %s trigger, When mutated, Then it is replaced by each of %j',
    (trigger, expected) => {
      // Act
      const result = mutateBody(sut, start(trigger))

      // Assert
      expect(result.map(r => r.mutation.edits[0].replacement)).toEqual(expected)
      expect(result[0].xml).toContain(
        `<recordTriggerType>${expected[0]}</recordTriggerType>`
      )
      expect(result[0].mutation).toMatchObject({
        mutatorName: 'RecordTriggerTypeMutator',
        elementName: '$Start',
        description: `Changed recordTriggerType from '${trigger}' to '${expected[0]}'`,
      })
    }
  )

  it('Given a trigger type with no replacement, When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(mutateBody(sut, start('Delete'))).toEqual([])
    expect(mutateBody(sut, start('constructor'))).toEqual([])
  })

  it('Given an empty trigger type, When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(mutateBody(sut, start(''))).toEqual([])
  })

  it('Given no start element, or a start without trigger type, When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(mutateBody(sut, '    <label>x</label>')).toEqual([])
    expect(mutateBody(sut, '    <start>\n    </start>')).toEqual([])
  })
})
