import { FlowXmlDom } from '../../flow/xml/FlowXmlDom.js'
import {
  FlowNotFoundError,
  FlowTestNotFoundError,
  NoFlowTestsError,
} from '../../port/flowErrors.js'
import type {
  FlowSource,
  FlowSourceProvider,
  FlowTestSource,
} from '../../port/flowSourceProvider.js'
import type { FlowMetadataRepository } from './flowMetadataRepository.js'
import type { FlowTestDiscovery } from './flowTestDiscovery.js'

const FLOW_TESTING_PREFIX = 'FlowTesting.'

// A FlowTest may be named the way the test runner spells it
// (FlowTesting.<flow>.<test>), qualified by its flow (<flow>.<test>), or bare.
export const toFlowTestName = (name: string, flowApiName: string): string => {
  const unprefixed = name.startsWith(FLOW_TESTING_PREFIX)
    ? name.slice(FLOW_TESTING_PREFIX.length)
    : name
  return unprefixed.startsWith(`${flowApiName}.`)
    ? unprefixed.slice(flowApiName.length + 1)
    : unprefixed
}

const belongsTo = (test: FlowTestSource, flowApiName: string): boolean => {
  const dom = FlowXmlDom.parse(test.xml)
  return dom.childText(dom.root, 'flowApiName') === flowApiName
}

export class OrgFlowSourceProvider implements FlowSourceProvider {
  constructor(
    private readonly metadata: FlowMetadataRepository,
    private readonly discovery: FlowTestDiscovery
  ) {}

  public async readFlow(
    apiName: string,
    testNames?: string[]
  ): Promise<FlowSource> {
    const requested = testNames?.map(name => toFlowTestName(name, apiName))
    const names = requested ?? (await this.discovery.listTestNames(apiName))
    if (names.length === 0) {
      throw new NoFlowTestsError(apiName)
    }

    const files = await this.metadata.retrieve([
      { type: 'Flow', fullNames: [apiName] },
      { type: 'FlowTest', fullNames: names },
    ])
    const flow = files.find(
      file => file.type === 'Flow' && file.fullName === apiName
    )
    if (!flow) {
      throw new FlowNotFoundError(apiName)
    }
    // Only the FlowTests asked for are run and unpinned. A FlowTest of another
    // flow that happens to answer to a requested name is not one of ours: it
    // is reported as missing, never touched.
    // Stryker disable ConditionalExpression: a Flow file answering to a
    // requested name has no <flowApiName>, so belongsTo drops it anyway.
    const isRequested = (file: FlowTestSource & { type: string }) =>
      file.type === 'FlowTest' && names.includes(file.fullName)
    // Stryker restore ConditionalExpression
    const tests = files
      .filter(isRequested)
      .map(file => ({ fullName: file.fullName, xml: file.xml }))
      .filter(test => belongsTo(test, apiName))
    const missing = names.filter(
      name => !tests.some(test => test.fullName === name)
    )
    if (missing.length > 0) {
      throw new FlowTestNotFoundError(apiName, missing)
    }
    return { apiName, xml: flow.xml, tests }
  }
}
