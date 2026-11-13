import { SF_NAMESPACE } from '../../src/flow/xml/FlowXmlDom.js'

// Flow XML in the shape a Metadata API retrieve produces: four-space
// indentation, children in alphabetical order, a trailing newline.
export const flowXml = (body: string, status = 'Draft'): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="${SF_NAMESPACE}">
${body}
    <status>${status}</status>
</Flow>
`

export const recordTriggeredFlowXml = (status = 'Draft'): string =>
  flowXml(
    `    <apiVersion>66.0</apiVersion>
    <processType>AutoLaunchedFlow</processType>
    <start>
        <object>Account</object>
        <recordTriggerType>Create</recordTriggerType>
        <triggerType>RecordAfterSave</triggerType>
    </start>`,
    status
  )

export const flowTestXml = (
  flowApiName: string,
  pinnedVersions: number[] = []
): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<FlowTest xmlns="${SF_NAMESPACE}">
    <flowApiName>${flowApiName}</flowApiName>
${pinnedVersions
  .map(
    version =>
      `    <flowTestFlowVersions>\n        <flowVersionNumber>${version}</flowVersionNumber>\n    </flowTestFlowVersions>\n`
  )
  .join('')}    <label>A test</label>
    <testType>WithAssertion</testType>
</FlowTest>
`
