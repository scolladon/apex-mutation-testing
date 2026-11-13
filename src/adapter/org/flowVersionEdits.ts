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

// The XML to deploy for a version of this run: always Draft — a version only
// ever becomes Active through an explicit activation the run undoes — and,
// when `marked`, carrying the temporary-version marker in its description.
export const toDraftXml = (xml: string, marked: boolean): string => {
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
    const description = dom.child(dom.root, 'description')
    const current = dom.text(description)
    edits.push(
      description
        ? dom.replaceTextEdit(
            description,
            current
              ? `${current} ${TEMPORARY_VERSION_MARKER}`
              : TEMPORARY_VERSION_MARKER
          )
        : dom.insertChildEdit(
            dom.root,
            'description',
            `<description>${escapeXmlText(TEMPORARY_VERSION_MARKER)}</description>`
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

// The FlowTest with every flow-version association removed. A FlowTest runs
// against one version only — the Active one, or the latest when none is —
// and is silently skipped when it is associated with versions that do not
// include it; without any association it always runs. A FlowTest with no
// association comes back unchanged: no edit, no byte touched.
export const unpinFlowTest = (xml: string): string => {
  const dom = FlowXmlDom.parse(xml)
  return applyEdits(
    xml,
    dom
      .children(dom.root, 'flowTestFlowVersions')
      .map(entry => dom.removeElementEdit(entry))
  )
}
