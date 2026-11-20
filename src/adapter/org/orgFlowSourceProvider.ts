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
import type {
  FlowMetadataFile,
  FlowMetadataRepository,
} from './flowMetadataRepository.js'
import type { FlowTestDiscovery } from './flowTestDiscovery.js'

const FLOW_TESTING_PREFIX = 'FlowTesting.'

// Salesforce API names are case-insensitive: the org answers to any spelling
// and reports its own. That one has to be used from then on — the test runner
// matches names exactly and runs nothing for another spelling.
const sameName = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase()

const withoutPrefix = (name: string, prefix: string): string =>
  sameName(name.slice(0, prefix.length), prefix)
    ? name.slice(prefix.length)
    : name

// A FlowTest may be named the way the test runner spells it
// (FlowTesting.<flow>.<test>), qualified by its flow (<flow>.<test>), or bare.
export const toFlowTestName = (name: string, flowApiName: string): string =>
  withoutPrefix(withoutPrefix(name, FLOW_TESTING_PREFIX), `${flowApiName}.`)

// The names as given, each once whatever its spelling.
const distinct = (names: string[]): string[] =>
  names.filter(
    (name, index) => names.findIndex(other => sameName(other, name)) === index
  )

const belongsTo = (test: FlowTestSource, flowApiName: string): boolean => {
  const dom = FlowXmlDom.parse(test.xml)
  const owner = dom.childText(dom.root, 'flowApiName')
  return owner !== undefined && sameName(owner, flowApiName)
}

export class OrgFlowSourceProvider implements FlowSourceProvider {
  constructor(
    private readonly metadata: FlowMetadataRepository,
    private readonly discovery: FlowTestDiscovery
  ) {}

  // The flow and its FlowTests as the org holds them, named as the org
  // spells them.
  public async readFlow(
    apiName: string,
    testNames?: string[]
  ): Promise<FlowSource> {
    const names = testNames
      ? distinct(testNames.map(name => toFlowTestName(name, apiName)))
      : await this.discovery.listTestNames(apiName)
    if (names.length === 0) {
      // A flow name nothing answers to is a typo, not a flow without tests.
      const flow = await this.retrieveFlow(apiName)
      throw new NoFlowTestsError(flow.fullName)
    }

    const files = await this.metadata.retrieve([
      { type: 'Flow', fullNames: [apiName] },
      { type: 'FlowTest', fullNames: names },
    ])
    const flow = this.flowOf(files, apiName)
    // Only the FlowTests asked for are run and unpinned. A FlowTest of another
    // flow that happens to answer to a requested name is not one of ours: it
    // is reported as missing, never touched.
    // Stryker disable ConditionalExpression: a Flow file answering to a
    // requested name has no <flowApiName>, so belongsTo drops it anyway.
    const isRequested = (file: FlowMetadataFile) =>
      file.type === 'FlowTest' &&
      names.some(name => sameName(name, file.fullName))
    // Stryker restore ConditionalExpression
    const tests = files
      .filter(isRequested)
      .map(file => ({ fullName: file.fullName, xml: file.xml }))
      .filter(test => belongsTo(test, flow.fullName))
    const missing = names.filter(
      name => !tests.some(test => sameName(test.fullName, name))
    )
    if (missing.length > 0) {
      throw new FlowTestNotFoundError(flow.fullName, missing)
    }
    return { apiName: flow.fullName, xml: flow.xml, tests }
  }

  private async retrieveFlow(apiName: string): Promise<FlowMetadataFile> {
    return this.flowOf(
      await this.metadata.retrieve([{ type: 'Flow', fullNames: [apiName] }]),
      apiName
    )
  }

  private flowOf(files: FlowMetadataFile[], apiName: string): FlowMetadataFile {
    const flow = files.find(
      file => file.type === 'Flow' && sameName(file.fullName, apiName)
    )
    if (!flow) {
      throw new FlowNotFoundError(apiName)
    }
    return flow
  }
}
