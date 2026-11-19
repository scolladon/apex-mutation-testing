import { ConnectorBypassMutator } from '../../../../src/flow/mutators/ConnectorBypassMutator.js'
import { mutateBody } from '../../../utils/flowMutatorHarness.js'

const connector = (target: string, tag = 'connector') =>
  `<${tag}>\n            <targetReference>${target}</targetReference>\n        </${tag}>`

const element = (tag: string, name: string, extra = '') =>
  `    <${tag}>\n        <name>${name}</name>\n        ${extra}\n    </${tag}>`

describe('ConnectorBypassMutator', () => {
  const sut = new ConnectorBypassMutator()

  it('Given an element with a successor, When mutated, Then every incoming connector is rewired to the successor in one mutant, anchored at the element', () => {
    // Arrange
    const middle = element('assignments', 'Middle', connector('End'))
    const body = `${middle}
    <decisions>
        <name>D</name>
        ${connector('Middle', 'defaultConnector')}
    </decisions>
    <start>
        ${connector('Middle')}
    </start>`

    // Act
    const results = mutateBody(sut, body)

    // Assert
    expect(results).toHaveLength(1)
    const [{ mutation, xml, source }] = results
    expect(mutation).toMatchObject({
      mutatorName: 'ConnectorBypassMutator',
      elementName: 'Middle',
      description:
        "Bypassed assignments element 'Middle' by rewiring incoming connectors directly to 'End'",
      replacement: '',
    })
    expect(mutation.edits).toHaveLength(2)
    expect(source.slice(mutation.anchor.start, mutation.anchor.end)).toBe(
      middle.trimStart()
    )
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
      const body = `${element(tag, 'Middle', connector('End'))}
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

  it('Given a decision or a loop between two others, When mutated, Then it is not bypassed', () => {
    // Arrange
    const body = `${element('decisions', 'D', connector('End', 'defaultConnector'))}
${element('loops', 'L', connector('End', 'noMoreValuesConnector'))}
    <start>
        ${connector('D')}
    </start>`

    // Act & Assert
    expect(mutateBody(sut, body)).toEqual([])
  })

  it('Given an element nothing points to, When mutated, Then nothing is produced', () => {
    // Act & Assert
    expect(
      mutateBody(sut, element('recordUpdates', 'Orphan', connector('End')))
    ).toEqual([])
  })

  it('Given a terminal element reached from two decision outcomes, When mutated, Then each outcome loses its connector in its own mutant', () => {
    // Arrange
    const body = `    <decisions>
        <name>Check</name>
        <rules>
            ${connector('Last')}
            <name>Yes</name>
        </rules>
        <rules>
            ${connector('Last')}
            <name>Also</name>
        </rules>
    </decisions>
${element('recordCreates', 'Last')}`

    // Act
    const results = mutateBody(sut, body)

    // Assert
    expect(results.map(r => r.mutation.description)).toEqual([
      "Bypassed terminal recordCreates element 'Last' by removing the connector of rule 'Yes' in decision 'Check'",
      "Bypassed terminal recordCreates element 'Last' by removing the connector of rule 'Also' in decision 'Check'",
    ])
    expect(
      results[0].xml.match(/<targetReference>Last<\/targetReference>/g)
    ).toHaveLength(1)
    expect(results[0].xml).toContain('<name>Yes</name>')
    expect(results[0].mutation.edits[0].replacement).toBe('')
    expect(results[0].mutation.replacement).toBe('')
    const { start, end } = results[0].mutation.anchor
    expect(results[0].source.slice(start, end)).toContain('<name>Last</name>')
    expect(results[0].source.slice(start, end)).toMatch(
      /^<recordCreates>[\s\S]*<\/recordCreates>$/
    )
  })

  it.each([
    [
      'the connector of another element',
      element('assignments', 'Before', connector('Last')),
      "the connector from 'Before'",
    ],
    [
      'the default outcome of a decision',
      element('decisions', 'Check', connector('Last', 'defaultConnector')),
      "the default outcome of 'Check'",
    ],
    [
      'the exit of a loop',
      element('loops', 'Each', connector('Last', 'noMoreValuesConnector')),
      "the exit of loop 'Each'",
    ],
    [
      'the connector of an unnamed rule',
      `    <decisions>\n        <rules>\n            ${connector('Last')}\n        </rules>\n    </decisions>`,
      "the connector of rule 'rules' in decision 'decisions'",
    ],
    [
      'the connector of an unnamed element',
      `    <assignments>\n        ${connector('Last')}\n    </assignments>`,
      "the connector from 'assignments'",
    ],
  ])(
    'Given a terminal element reached through %s, When mutated, Then that connector is removed',
    (_label, predecessor, removed) => {
      // Act
      const results = mutateBody(
        sut,
        `${predecessor}\n${element('recordUpdates', 'Last')}`
      )

      // Assert
      expect(results.map(r => r.mutation.description)).toContain(
        `Bypassed terminal recordUpdates element 'Last' by removing ${removed}`
      )
      const detach = results.find(r =>
        r.mutation.description.includes('terminal')
      )
      expect(detach?.xml).not.toContain(
        '<targetReference>Last</targetReference>'
      )
    }
  )

  it('Given a terminal element reached from the immediate path and from an element only the Async Path reaches, When mutated, Then only the connector a FlowTest can exercise is removed', () => {
    // Arrange — Async_Step runs after commit, which no FlowTest runs
    const body = [
      element('assignments', 'Now', connector('Last')),
      element('assignments', 'Async_Step', connector('Last')),
      element('recordUpdates', 'Last'),
      `    <start>\n        ${connector('Now')}\n        <scheduledPaths>\n            ${connector('Async_Step')}\n            <pathType>AsyncAfterCommit</pathType>\n        </scheduledPaths>\n    </start>`,
    ].join('\n')

    // Act
    const detaches = mutateBody(sut, body).filter(r =>
      r.mutation.description.includes('terminal')
    )

    // Assert
    expect(detaches.map(r => r.mutation.description)).toEqual([
      "Bypassed terminal recordUpdates element 'Last' by removing the connector from 'Now'",
    ])
  })

  it.each([
    ['the start', `    <start>\n        ${connector('Last')}\n    </start>`],
    [
      'a scheduled path',
      `    <start>\n        <scheduledPaths>\n            ${connector('Last')}\n            <pathType>AsyncAfterCommit</pathType>\n        </scheduledPaths>\n    </start>`,
    ],
    [
      "a loop's next value",
      element('loops', 'Each', connector('Last', 'nextValueConnector')),
    ],
    [
      'a fault path',
      element('recordCreates', 'Make', connector('Last', 'faultConnector')),
    ],
  ])(
    'Given a terminal element reached only through %s, When mutated, Then no connector is removed',
    (_label, predecessor) => {
      // Act & Assert
      expect(
        mutateBody(sut, `${predecessor}\n${element('recordUpdates', 'Last')}`)
      ).toEqual([])
    }
  )

  it('Given a terminal element reached from a decision outcome only the Async Path reaches, When mutated, Then that outcome keeps its connector', () => {
    // Arrange — the outcome's owner is its decision, which runs after commit
    const decision = `    <decisions>
        <name>Async_Check</name>
        <rules>
            <name>Hot</name>
            ${connector('Last')}
        </rules>
    </decisions>`
    const body = [
      element('assignments', 'Now', connector('Last')),
      decision,
      element('recordUpdates', 'Last'),
      `    <start>\n        ${connector('Now')}\n        <scheduledPaths>\n            ${connector('Async_Check')}\n            <pathType>AsyncAfterCommit</pathType>\n        </scheduledPaths>\n    </start>`,
    ].join('\n')

    // Act
    const detaches = mutateBody(sut, body)
      .map(r => r.mutation.description)
      .filter(description => description.includes('terminal'))

    // Assert
    expect(detaches).toEqual([
      "Bypassed terminal recordUpdates element 'Last' by removing the connector from 'Now'",
    ])
  })

  it('Given an unnamed bypassable element, When mutated, Then it is skipped', () => {
    // Arrange — the empty name is still a key other connectors could reach
    const body = `    <subflows>\n        ${connector('End')}\n    </subflows>
    <subflows>\n        <name></name>\n        ${connector('End')}\n    </subflows>
    <start>\n        <connector><targetReference></targetReference></connector>\n    </start>`

    // Act & Assert
    expect(mutateBody(sut, body)).toEqual([])
  })

  it('Given an element name containing a quote, When generating mutants, Then generation does not crash', () => {
    // Arrange — review proof: the name used to be interpolated into an XPath
    const body = `${element('assignments', "a'b", connector('End'))}
${element('recordDeletes', "c'd", connector("a'b"))}
    <start>
        ${connector("c'd")}
    </start>`

    // Act
    const results = mutateBody(sut, body)

    // Assert — recordDeletes is scanned before assignments
    expect(results.map(r => r.mutation.elementName)).toEqual(["c'd", "a'b"])
  })

  it('Given connectors without a target, When mutated, Then they are ignored', () => {
    // Arrange
    const body = `    <assignments>
        <name>Middle</name>
        <connector>
            <targetReference></targetReference>
        </connector>
    </assignments>
    <start>
        <connector>
            <targetReference>   </targetReference>
        </connector>
    </start>`

    // Act & Assert
    expect(mutateBody(sut, body)).toEqual([])
  })
})
