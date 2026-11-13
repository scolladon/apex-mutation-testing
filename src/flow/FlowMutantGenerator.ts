import { getDefaultFlowMutators } from './mutators/index.js'
import type { FlowMutant, FlowMutator } from './types.js'
import type { FlowXmlDom } from './xml/FlowXmlDom.js'

// One parse, every mutator over it: generation is linear in the size of the
// flow. A mutant keeps its edits, not a mutated copy of the document.
export class FlowMutantGenerator {
  constructor(
    private readonly mutators: FlowMutator[] = getDefaultFlowMutators()
  ) {}

  public generate(dom: FlowXmlDom, allowedLines?: Set<number>): FlowMutant[] {
    return this.mutators
      .flatMap(mutator => mutator.mutate(dom))
      .map(mutation => {
        const [located] = mutation.edits
        return {
          mutation,
          located,
          location: {
            start: dom.positionAt(located.start),
            end: dom.positionAt(located.end),
          },
        }
      })
      .filter(
        ({ location }) => !allowedLines || allowedLines.has(location.start.line)
      )
      .map(({ mutation, located, location }, index) => ({
        ...mutation,
        id: `FLOW-MUT-${index + 1}`,
        status: 'Pending' as const,
        location,
        replacement: located.replacement,
      }))
  }
}
