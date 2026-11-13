import { FlowMutantGenerator } from '../../../src/flow/FlowMutantGenerator.js'
import type { FlowMutator } from '../../../src/flow/types.js'
import { FlowXmlDom } from '../../../src/flow/xml/FlowXmlDom.js'
import { flowXml, recordTriggeredFlowXml } from '../../utils/flowFixtures.js'

describe('FlowMutantGenerator', () => {
  it('Given the default mutators, When generating, Then mutants are numbered, Pending and located on the edited text', () => {
    // Arrange
    const dom = FlowXmlDom.parse(recordTriggeredFlowXml())
    const sut = new FlowMutantGenerator()

    // Act
    const mutants = sut.generate(dom)

    // Assert
    expect(mutants).toHaveLength(1)
    expect(mutants[0]).toMatchObject({
      id: 'FLOW-MUT-1',
      status: 'Pending',
      mutatorName: 'RecordTriggerTypeMutator',
      replacement: 'Update',
      location: {
        start: { line: 7, column: 28 },
        end: { line: 7, column: 34 },
      },
    })
  })

  it('Given allowed lines, When generating, Then only mutants starting on those lines are kept and numbering stays contiguous', () => {
    // Arrange
    const dom = FlowXmlDom.parse(
      flowXml(
        '    <start>\n        <recordTriggerType>CreateAndUpdate</recordTriggerType>\n    </start>\n    <formulas>\n        <expression>a == b</expression>\n    </formulas>'
      )
    )
    const sut = new FlowMutantGenerator()

    // Act
    const mutants = sut.generate(dom, new Set([7]))

    // Assert
    expect(mutants.map(m => [m.id, m.mutatorName])).toEqual([
      ['FLOW-MUT-1', 'FormulaExpressionMutator'],
    ])
  })

  it('Given custom mutators, When generating, Then the document is parsed by nobody but the caller and each mutator sees it once', () => {
    // Arrange
    const dom = FlowXmlDom.parse(recordTriggeredFlowXml())
    const parse = vi.spyOn(FlowXmlDom, 'parse')
    const mutate = vi.fn().mockReturnValue([])
    const mutator: FlowMutator = { name: 'Spy', mutate }
    const sut = new FlowMutantGenerator([mutator, mutator])

    // Act
    const mutants = sut.generate(dom)

    // Assert
    expect(mutants).toEqual([])
    expect(parse).not.toHaveBeenCalled()
    expect(mutate).toHaveBeenCalledTimes(2)
    expect(mutate).toHaveBeenCalledWith(dom)
    parse.mockRestore()
  })

  it('Given a large flow, When generating, Then the cost stays linear: mutants hold edits, not documents', () => {
    // Arrange — review benchmark: 800 assignments took 256 s when every
    // mutant re-parsed and serialised the whole document
    const items = Array.from(
      { length: 800 },
      (_, i) =>
        `    <assignments>\n        <name>A${i}</name>\n        <assignmentItems>\n            <assignToReference>v</assignToReference>\n            <operator>Add</operator>\n            <value><numberValue>${i}</numberValue></value>\n        </assignmentItems>\n    </assignments>`
    ).join('\n')
    const dom = FlowXmlDom.parse(flowXml(items))
    const sut = new FlowMutantGenerator()

    // Act
    const start = performance.now()
    const mutants = sut.generate(dom)
    const elapsedMs = performance.now() - start

    // Assert
    expect(mutants).toHaveLength(1600)
    expect(elapsedMs).toBeLessThan(5000)
    expect(mutants.every(m => !('mutatedXml' in m))).toBe(true)
  })
})
