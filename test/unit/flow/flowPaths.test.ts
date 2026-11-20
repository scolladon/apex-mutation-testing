import { analyzeFlowPaths } from '../../../src/flow/flowPaths.js'
import { FlowXmlDom } from '../../../src/flow/xml/FlowXmlDom.js'
import { flowXml } from '../../utils/flowFixtures.js'

const connector = (target: string, tag = 'connector') =>
  `<${tag}><targetReference>${target}</targetReference></${tag}>`

const element = (name: string, ...connectors: string[]) =>
  `    <assignments>\n        <name>${name}</name>\n        ${connectors.join('\n        ')}\n    </assignments>`

const path = (target: string, pathType?: string) =>
  `<scheduledPaths>${connector(target)}${pathType ? `<pathType>${pathType}</pathType>` : ''}</scheduledPaths>`

const start = (...children: string[]) =>
  `    <start>\n        ${children.join('\n        ')}\n    </start>`

const analyze = (body: string) =>
  analyzeFlowPaths(FlowXmlDom.parse(flowXml(body)))

describe('analyzeFlowPaths', () => {
  it('Given a flow with neither kind of path, When analyzed, Then nothing is async-only', () => {
    // Act
    const sut = analyze(`${element('A')}\n${start(connector('A'))}`)

    // Assert
    expect(sut).toEqual({
      hasScheduledPath: false,
      hasAsyncPath: false,
      asyncOnlyElements: new Set(),
    })
  })

  it('Given a Scheduled Path, When analyzed, Then it is reported and its elements are tested', () => {
    // Act
    const sut = analyze(
      `${element('Later')}\n${start(path('Later', 'RecordField'))}`
    )

    // Assert
    expect(sut).toEqual({
      hasScheduledPath: true,
      hasAsyncPath: false,
      asyncOnlyElements: new Set(),
    })
  })

  it('Given a scheduled path without a path type, When analyzed, Then it is a Scheduled Path', () => {
    // Act & Assert
    expect(analyze(start(path('X'))).hasScheduledPath).toBe(true)
  })

  it('Given an Async Path, When analyzed, Then the elements only it reaches are async-only, following every connector', () => {
    // Arrange
    const body = `${element('Async_1', connector('Async_2', 'faultConnector'))}
${element('Async_2', connector('Async_1'))}
${element('Shared')}
${element('Now', connector('Shared'))}
${start(connector('Now'), path('Async_1', 'AsyncAfterCommit'))}`

    // Act
    const sut = analyze(body)

    // Assert
    expect(sut.hasAsyncPath).toBe(true)
    expect(sut.hasScheduledPath).toBe(false)
    expect(sut.asyncOnlyElements).toEqual(new Set(['Async_1', 'Async_2']))
  })

  it('Given an element reached from the Async Path and from a Scheduled Path, When analyzed, Then it is not async-only', () => {
    // Arrange
    const body = `${element('Both')}
${element('Only_Async', connector('Both'))}
${start(path('Only_Async', 'AsyncAfterCommit'), path('Both', 'RecordField'))}`

    // Act
    const sut = analyze(body)

    // Assert
    expect(sut).toEqual({
      hasScheduledPath: true,
      hasAsyncPath: true,
      asyncOnlyElements: new Set(['Only_Async']),
    })
  })

  it('Given a start without connector and an Async Path to an unknown element, When analyzed, Then the unknown name is async-only and nothing breaks', () => {
    // Act
    const sut = analyze(start(path('Ghost', 'AsyncAfterCommit')))

    // Assert
    expect(sut.asyncOnlyElements).toEqual(new Set(['Ghost']))
  })

  it('Given an element the start reaches through another, and the Async Path reaches directly, When analyzed, Then it is not async-only', () => {
    // Arrange — Start → First → Shared, Async Path → Shared
    const body = `${element('First', connector('Shared'))}
${element('Shared')}
${start(connector('First'), path('Shared', 'AsyncAfterCommit'))}`

    // Act
    const sut = analyze(body)

    // Assert
    expect(sut.asyncOnlyElements).toEqual(new Set())
  })

  it('Given a connector without target listed after a real one, When analyzed, Then the walk still follows the real one', () => {
    // Arrange — an empty target must not end the walk before Shared
    const body = `${element('First', connector('Shared'), '<faultConnector><targetReference></targetReference></faultConnector>')}
${element('Shared')}
${start(connector('First'), path('Shared', 'AsyncAfterCommit'))}`

    // Act
    const sut = analyze(body)

    // Assert
    expect(sut.asyncOnlyElements).toEqual(new Set())
  })

  it('Given no start, When analyzed, Then no path is reported', () => {
    // Act
    const sut = analyze(element('A'))

    // Assert
    expect(sut).toEqual({
      hasScheduledPath: false,
      hasAsyncPath: false,
      asyncOnlyElements: new Set(),
    })
  })

  it('Given connectors without a target and unnamed elements, When analyzed, Then they are ignored', () => {
    // Arrange
    const body = `    <assignments>\n        ${connector('Async_1')}\n    </assignments>
${element('Async_1', '<connector><targetReference></targetReference></connector>')}
    <label>Not an element</label>
${start(path('Async_1', 'AsyncAfterCommit'), '<scheduledPaths><pathType>AsyncAfterCommit</pathType></scheduledPaths>')}`

    // Act
    const sut = analyze(body)

    // Assert
    expect(sut.asyncOnlyElements).toEqual(new Set(['Async_1']))
  })

  describe('formulas', () => {
    const formula = (name: string, expression: string) =>
      `    <formulas>\n        <name>${name}</name>\n        <dataType>Boolean</dataType>\n        <expression>${expression}</expression>\n    </formulas>`
    const template = (name: string, text: string) =>
      `    <textTemplates>\n        <name>${name}</name>\n        <text>${text}</text>\n    </textTemplates>`
    const using = (name: string, reference: string, ...connectors: string[]) =>
      `    <decisions>\n        <name>${name}</name>\n        <rules><conditions><leftValueReference>${reference}</leftValueReference></conditions></rules>\n        ${connectors.join('\n        ')}\n    </decisions>`
    const asyncFlow = (...body: string[]) =>
      [
        ...body,
        element('Now'),
        start(connector('Now'), path('Later', 'AsyncAfterCommit')),
      ].join('\n')

    it.each([
      [
        'used only by an async-only element',
        asyncFlow(formula('IsHot', 'true'), using('Later', 'IsHot')),
        true,
      ],
      [
        'used, in another case, only by an async-only element',
        asyncFlow(formula('IsHot', 'true'), using('Later', 'isHOT')),
        true,
      ],
      [
        'used only through another formula an async-only element uses',
        asyncFlow(
          formula('IsHot', 'true'),
          formula('IsHotter', '{!IsHot} &amp;&amp; true'),
          using('Later', 'IsHotter')
        ),
        true,
      ],
      [
        'used only through a text template an async-only element uses',
        asyncFlow(
          formula('IsHot', 'true'),
          template('Body', 'Hot: {!IsHot}'),
          using('Later', 'Body')
        ),
        true,
      ],
      [
        'used by an async-only element and by a tested one',
        asyncFlow(
          formula('IsHot', 'true'),
          using('Later', 'IsHot'),
          using('Tested', 'IsHot')
        ),
        false,
      ],
      [
        'used through a formula a tested element uses',
        asyncFlow(
          formula('IsHot', 'true'),
          formula('IsHotter', '{!IsHot}'),
          using('Later', 'IsHot'),
          using('Tested', 'IsHotter')
        ),
        false,
      ],
      [
        'used by the start',
        [
          formula('IsHot', 'true'),
          using('Later', 'IsHot'),
          element('Now'),
          start(
            connector('Now'),
            path('Later', 'AsyncAfterCommit'),
            '<filterFormula>{!IsHot}</filterFormula>'
          ),
        ].join('\n'),
        false,
      ],
      [
        'used by a variable, which is no element',
        asyncFlow(
          formula('IsHot', 'true'),
          using('Later', 'IsHot'),
          '    <variables>\n        <name>v</name>\n        <value><elementReference>IsHot</elementReference></value>\n    </variables>'
        ),
        false,
      ],
      [
        'used through two formulas, both used only by an async-only element',
        asyncFlow(
          formula('IsHot', 'true'),
          formula('Left', '{!IsHot}'),
          formula('Right', '{!IsHot}'),
          formula('Both', '{!Left} &amp;&amp; {!Right}'),
          using('Later', 'Both')
        ),
        true,
      ],
      [
        'used by an unnamed text template, which may be anywhere',
        asyncFlow(
          formula('IsHot', 'true'),
          '    <textTemplates>\n        <text>Hot: {!IsHot}</text>\n    </textTemplates>',
          using('Later', 'IsHot')
        ),
        false,
      ],
      [
        'used by nothing at all',
        asyncFlow(formula('IsHot', 'true'), using('Later', 'Other')),
        false,
      ],
      [
        'whose name is only part of a longer name used',
        asyncFlow(
          formula('IsHot', 'true'),
          using('Later', 'IsHot'),
          using('Tested', 'IsHotter')
        ),
        true,
      ],
      [
        'used only by formulas using each other',
        asyncFlow(
          formula('IsHot', '{!IsHotter}'),
          formula('IsHotter', '{!IsHot}')
        ),
        false,
      ],
      [
        'named with a regular-expression character, used only by an async-only element',
        asyncFlow(formula('Is.Hot', 'true'), using('Later', 'Is.Hot')),
        true,
      ],
      [
        'named with a regular-expression character, used by a tested element',
        asyncFlow(formula('Is.Hot', 'true'), using('Tested', 'IsXHot')),
        false,
      ],
    ])(
      'Given a formula %s, When analyzed, Then it is async-only: %s',
      (_label, body, asyncOnly) => {
        // Act
        const sut = analyze(body)

        // Assert
        const formulaName = body.includes('Is.Hot') ? 'Is.Hot' : 'IsHot'
        expect(sut.asyncOnlyElements.has(formulaName)).toBe(asyncOnly)
      }
    )

    it('Given a text template used only by an async-only element, When analyzed, Then only formulas join the async-only elements', () => {
      // Act
      const sut = analyze(
        asyncFlow(
          formula('IsHot', 'true'),
          template('Body', 'Hot: {!IsHot}'),
          using('Later', 'Body')
        )
      )

      // Assert
      expect(sut.asyncOnlyElements).toEqual(new Set(['Later', 'IsHot']))
    })

    it('Given an unnamed formula, When analyzed, Then it is left alone', () => {
      // Act
      const sut = analyze(
        asyncFlow(
          '    <formulas>\n        <expression>true</expression>\n    </formulas>',
          using('Later', 'x')
        )
      )

      // Assert
      expect([...sut.asyncOnlyElements]).toEqual(['Later'])
    })
  })
})
