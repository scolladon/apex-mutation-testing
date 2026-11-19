// cspell:ignore connectorbypassmutator decisionoperatormutator
import { FlowMutantGenerator } from '../../../src/flow/FlowMutantGenerator.js'
import type { FlowMutation, FlowMutator } from '../../../src/flow/types.js'
import { FlowXmlDom } from '../../../src/flow/xml/FlowXmlDom.js'
import { flowXml, recordTriggeredFlowXml } from '../../utils/flowFixtures.js'

const fixed = (name: string, mutations: FlowMutation[]): FlowMutator => ({
  name,
  mutate: () => mutations,
})

const mutation = (
  elementName: string,
  anchor: { start: number; end: number },
  edits = [{ start: 0, end: 0, replacement: 'x' }]
): FlowMutation => ({
  mutatorName: 'M',
  elementName,
  description: `changes ${elementName}`,
  edits,
  anchor,
  replacement: 'shown',
})

describe('FlowMutantGenerator', () => {
  it('Given the default mutators, When generating, Then mutants are numbered, Pending and located at their anchor', () => {
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

  it('Given a mutation whose anchor is not its first edit, When generating, Then it is located and filtered by the anchor', () => {
    // Arrange — lines 3 and 5 of a six-line document
    const dom = FlowXmlDom.parse('<a>\n<b/>\n<c/>\n<d/>\n<e/>\n</a>')
    const anchored = mutation('E', { start: 19, end: 23 }, [
      { start: 4, end: 8, replacement: '' },
    ])
    const sut = new FlowMutantGenerator([fixed('M', [anchored])])

    // Act
    const all = sut.generate(dom)
    const onAnchorLine = sut.generate(dom, new Set([5]))
    const onEditLine = sut.generate(dom, new Set([2]))

    // Assert
    expect(all[0].location).toEqual({
      start: { line: 5, column: 1 },
      end: { line: 5, column: 5 },
    })
    expect(all[0].replacement).toBe('shown')
    expect(onAnchorLine).toHaveLength(1)
    expect(onEditLine).toEqual([])
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

  describe('mutator filter', () => {
    const dom = FlowXmlDom.parse('<a/>')
    const sut = new FlowMutantGenerator([
      fixed('DecisionOperatorMutator', [mutation('D', { start: 0, end: 1 })]),
      fixed('ConnectorBypassMutator', [mutation('C', { start: 0, end: 1 })]),
    ])
    const names = (filter?: { include?: string[]; exclude?: string[] }) =>
      sut.generate(dom, undefined, filter).map(m => m.elementName)

    it.each([
      [{ include: ['DecisionOperator'] }, ['D']],
      [{ include: [' connectorbypassmutator '] }, ['C']],
      [{ include: ['DECISIONOPERATORMUTATOR', 'ConnectorBypass'] }, ['D', 'C']],
      [{ include: ['Nothing'] }, []],
      [{ exclude: ['ConnectorBypass'] }, ['D']],
      [{ exclude: ['Nothing'] }, ['D', 'C']],
      [{ include: [] }, ['D', 'C']],
      [{ exclude: [] }, ['D', 'C']],
      [undefined, ['D', 'C']],
    ])(
      'Given the filter %j, When generating, Then %j are kept',
      (filter, expected) => {
        // Act & Assert
        expect(names(filter)).toEqual(expected)
      }
    )

    it.each([
      [{ include: ['DecisionOperator'] }, true],
      [{ exclude: ['DecisionOperator'] }, true],
      [{ include: ['Nothing'] }, true],
      [{ exclude: ['Nothing'] }, false],
      [{ include: [] }, false],
      [undefined, false],
    ])(
      'Given the filter %j, When asked whether it narrows, Then it is %s',
      (filter, expected) => {
        // Act & Assert
        expect(sut.narrows(filter)).toBe(expected)
      }
    )

    it('Given a name merely ending like a mutator, When filtering, Then only the exact name with or without the suffix matches', () => {
      // Act & Assert
      expect(names({ include: ['Operator'] })).toEqual([])
      expect(names({ include: ['DecisionOperatorMutatorX'] })).toEqual([])
    })
  })

  it('Given elements only the Async Path reaches, When generating, Then they get no mutant while the others do', () => {
    // Arrange
    const dom = FlowXmlDom.parse(
      flowXml(`    <assignments>
        <name>Later</name>
        <assignmentItems>
            <assignToReference>x</assignToReference>
            <operator>Assign</operator>
            <value><booleanValue>true</booleanValue></value>
        </assignmentItems>
    </assignments>
    <assignments>
        <name>Now</name>
        <assignmentItems>
            <assignToReference>x</assignToReference>
            <operator>Assign</operator>
            <value><booleanValue>true</booleanValue></value>
        </assignmentItems>
    </assignments>
    <start>
        <connector><targetReference>Now</targetReference></connector>
        <scheduledPaths>
            <connector><targetReference>Later</targetReference></connector>
            <pathType>AsyncAfterCommit</pathType>
        </scheduledPaths>
    </start>`)
    )
    const sut = new FlowMutantGenerator()

    // Act
    const mutants = sut.generate(dom)

    // Assert
    expect(mutants.map(m => m.elementName)).toEqual(['Now'])
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
        `    <assignments>\n        <name>A${i}</name>\n        <assignmentItems>\n            <assignToReference>v</assignToReference>\n            <operator>Add</operator>\n            <value><numberValue>${i + 1}</numberValue></value>\n        </assignmentItems>\n    </assignments>`
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
