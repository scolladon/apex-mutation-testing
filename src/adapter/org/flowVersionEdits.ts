import {
  applyEdits,
  escapeXmlText,
  FlowXmlDom,
  type XmlEdit,
} from '../../flow/xml/FlowXmlDom.js'

const DRAFT_STATUS = 'Draft'

// Appended to the description of every temporary version this run deploys
// beside an Active one. Deploying content identical to the Active version
// would not give the run a version of its own; the marker guarantees it
// does, and names the tool in Setup should a version ever outlive its run.
export const TEMPORARY_VERSION_MARKER = '[apex-mutation-testing]'

// The marker of one deploy of one run: TEMPORARY_VERSION_MARKER, which any
// run's leftover is recognized by, followed by a token unique to the deploy.
// Flow Builder copies a version's description into the version a user saves
// from it, so the marker alone does not prove a version is the run's; the
// token of the deploy just issued does.
export const deployMarker = (runId: string, sequence: number): string =>
  `${TEMPORARY_VERSION_MARKER} run=${runId}.${sequence}`

// The XML to deploy for a version of this run: always Draft — a version only
// ever becomes Active through an explicit activation the run undoes — and,
// when `marked`, carrying in its description the given marker (or, for
// `true`, TEMPORARY_VERSION_MARKER alone).
export const toDraftXml = (xml: string, marked: boolean | string): string => {
  const dom = FlowXmlDom.parse(xml)
  const edits: XmlEdit[] = []
  const status = dom.child(dom.root, 'status')
  if (status && dom.text(status) !== DRAFT_STATUS) {
    edits.push(dom.replaceTextEdit(status, DRAFT_STATUS))
  } else if (!status) {
    edits.push(
      dom.insertChildEdit(
        dom.root,
        'status',
        `<status>${DRAFT_STATUS}</status>`
      )
    )
  }
  if (marked) {
    const marker = marked === true ? TEMPORARY_VERSION_MARKER : marked
    const description = dom.child(dom.root, 'description')
    const current = dom.text(description)
    edits.push(
      description
        ? dom.replaceTextEdit(
            description,
            current ? `${current} ${marker}` : marker
          )
        : dom.insertChildEdit(
            dom.root,
            'description',
            `<description>${escapeXmlText(marker)}</description>`
          )
    )
  }
  return applyEdits(xml, edits)
}

// The flow version numbers a FlowTest is associated with.
export const pinnedVersions = (xml: string): number[] => {
  const dom = FlowXmlDom.parse(xml)
  return dom
    .children(dom.root, 'flowTestFlowVersions')
    .map(entry => Number(dom.childText(entry, 'flowVersionNumber')))
}

// Written at the start of the description of every FlowTest the run detaches
// from its flow versions, with the versions it was associated with: a run
// interrupted before its restore leaves a FlowTest the next run recognizes,
// and the message refusing it can say which associations to put back.
const FLOW_TEST_MARKER = /\[apex-mutation-testing pins=([0-9,]*)\]/

const flowTestMarker = (pins: number[]): string =>
  `[apex-mutation-testing pins=${pins.join(',')}]`

// The FlowTest with every flow-version association removed, marked. A
// FlowTest runs against one version only — the Active one, or the latest
// when none is — and is silently skipped when it is associated with versions
// that do not include it; without any association it always runs. A
// FlowTest with no association comes back unchanged: no edit, no byte
// touched, no marker.
export const unpinFlowTest = (xml: string): string => {
  const dom = FlowXmlDom.parse(xml)
  const entries = dom.children(dom.root, 'flowTestFlowVersions')
  if (entries.length === 0) return xml
  const marker = flowTestMarker(
    entries.map(entry => Number(dom.childText(entry, 'flowVersionNumber')))
  )
  const description = dom.child(dom.root, 'description')
  const current = dom.text(description)
  return applyEdits(xml, [
    ...entries.map(entry => dom.removeElementEdit(entry)),
    description
      ? dom.replaceTextEdit(
          description,
          current ? `${marker} ${current}` : marker
        )
      : dom.insertChildEdit(
          dom.root,
          'description',
          `<description>${escapeXmlText(marker)}</description>`
        ),
  ])
}

// The associations an interrupted run removed from this FlowTest, read from
// its marker; undefined when it carries none.
export const leftoverPins = (xml: string): number[] | undefined => {
  const dom = FlowXmlDom.parse(xml)
  const match = FLOW_TEST_MARKER.exec(
    // Stryker disable next-line StringLiteral: any fallback text without the
    // marker matches nothing, as the empty string does.
    dom.childText(dom.root, 'description') ?? ''
  )
  return match?.[1]
    .split(',')
    .filter(Boolean)
    .map(pin => Number(pin))
}
