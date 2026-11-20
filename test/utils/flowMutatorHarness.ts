import type { FlowMutation, FlowMutator } from '../../src/flow/types.js'
import { applyEdits, FlowXmlDom } from '../../src/flow/xml/FlowXmlDom.js'
import { flowXml } from './flowFixtures.js'

// Runs a mutator over a flow body and returns each mutation with the XML it
// would deploy, so assertions read as "the deployed flow contains ...".
export const mutateBody = (
  mutator: FlowMutator,
  body: string
): { mutation: FlowMutation; xml: string; source: string }[] => {
  const source = flowXml(body)
  const dom = FlowXmlDom.parse(source)
  return mutator.mutate(dom).map(mutation => ({
    mutation,
    xml: applyEdits(source, mutation.edits),
    source,
  }))
}
