import { ConnectorBypassMutator } from '../../../../src/flow/mutators/ConnectorBypassMutator.js'
import { mutateBody } from '../../../utils/flowMutatorHarness.js'

const connector = (target: string) =>
  `<connector>\n            <targetReference>${target}</targetReference>\n        </connector>`

describe('ConnectorBypassMutator', () => {
  const sut = new ConnectorBypassMutator()

  it('Given an element with a successor, When mutated, Then every incoming connector is rewired to the successor in one mutant', () => {
    // Arrange
    const body = `    <assignments>
        <name>Middle</name>
        ${connector('End')}
    </assignments>
    <decisions>
        <name>D</name>
        <defaultConnector>
            <targetReference>Middle</targetReference>
        </defaultConnector>
    </decisions>
    <start>
        ${connector('Middle')}
    </start>`

    // Act
    const results = mutateBody(sut, body)

    // Assert
    expect(results).toHaveLength(1)
    const [{ mutation, xml }] = results
    expect(mutation).toMatchObject({
      mutatorName: 'ConnectorBypassMutator',
      elementName: 'Middle',
      description:
        "Bypassed assignments element 'Middle' by rewiring incoming connectors directly to 'End'",
    })
    expect(mutation.edits).toHaveLength(2)
    expect(xml).not.toContain('<targetReference>Middle</targetReference>')
    expect(xml.match(/<targetReference>End<\/targetReference>/g)).toHaveLength(
      3
    )
  })

  it.each([
    ['subflows'],
    ['recordCreates'],
    ['recordUpdates'],
    ['recordDeletes'],
    ['assignments'],
    ['actionCalls'],
    ['recordLookups'],
  ])(
    'Given a %s element between two others, When mutated, Then it is bypassed',
    tag => {
      // Arrange
      const body = `    <${tag}>
        <name>Middle</name>
        ${connector('End')}
    </${tag}>
    <start>
        ${connector('Middle')}
    </start>`

      // Act
      const results = mutateBody(sut, body)

      // Assert
      expect(results.map(r => r.mutation.description)).toEqual([
        `Bypassed ${tag} element 'Middle' by rewiring incoming connectors directly to 'End'`,
      ])
    }
  )

  it('Given an element nothing points to, When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(
      mutateBody(
        sut,
        `    <recordUpdates>\n        <name>Orphan</name>\n        ${connector('End')}\n    </recordUpdates>`
      )
    ).toEqual([])
  })

  it('Given a terminal element reached from decision outcomes, When mutated, Then each outcome loses its connector in its own mutant', () => {
    // Arrange
    const body = `    <decisions>
        <name>D</name>
        <rules>
            ${connector('Last')}
            <name>Yes</name>
        </rules>
        <rules>
            ${connector('Last')}
        </rules>
        <rules>
            ${connector('Other')}
            <name>No</name>
        </rules>
    </decisions>
    <recordCreates>
        <name>Last</name>
    </recordCreates>`

    // Act
    const results = mutateBody(sut, body)

    // Assert
    expect(results.map(r => r.mutation.description)).toEqual([
      "Bypassed terminal recordCreates element 'Last' in rule 'Yes' by removing connector",
      "Bypassed terminal recordCreates element 'Last' in rule 'Rule' by removing connector",
    ])
    expect(results[0].xml).not.toContain(
      '<targetReference>Last</targetReference>\n        </connector>\n            <name>Yes'
    )
    expect(
      results[0].xml.match(/<targetReference>Last<\/targetReference>/g)
    ).toHaveLength(1)
    expect(results[0].mutation.edits[0].replacement).toBe('')
  })

  it('Given an unnamed bypassable element, When mutated, Then it is skipped', () => {
    // Act & Assert
    expect(
      mutateBody(
        sut,
        `    <subflows>\n        ${connector('End')}\n    </subflows>`
      )
    ).toEqual([])
  })

  it('Given an element name containing a quote, When generating mutants, Then generation does not crash', () => {
    // Arrange — review proof: the name used to be interpolated into an XPath
    const body = `    <assignments>
        <name>a'b</name>
        ${connector('End')}
    </assignments>
    <recordDeletes>
        <name>c'd</name>
    </recordDeletes>
    <decisions>
        <rules>
            ${connector("c'd")}
        </rules>
    </decisions>
    <start>
        ${connector("a'b")}
    </start>`

    // Act
    const results = mutateBody(sut, body)

    // Assert
    // recordDeletes is scanned before assignments
    expect(results.map(r => r.mutation.elementName)).toEqual(["c'd", "a'b"])
  })

  it('Given connectors without a target, When mutated, Then they are ignored', () => {
    // Arrange
    const body = `    <decisions>
        <rules>
            <connector>
                <targetReference></targetReference>
            </connector>
        </rules>
        <rules>
            <connector></connector>
        </rules>
    </decisions>
    <recordCreates>
        <name>Last</name>
    </recordCreates>`

    // Act & Assert
    expect(mutateBody(sut, body)).toEqual([])
  })
})
