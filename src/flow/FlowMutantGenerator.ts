import { analyzeFlowPaths } from './flowPaths.js'
import { getDefaultFlowMutators } from './mutators/index.js'
import type { FlowMutant, FlowMutator } from './types.js'
import type { FlowXmlDom } from './xml/FlowXmlDom.js'

export type FlowMutatorFilter = { include?: string[]; exclude?: string[] }

const MUTATOR_SUFFIX = 'mutator'

// A mutator answers to its name with or without the "Mutator" suffix, in any
// case: "ConnectorBypass" and "connectorbypassmutator" both name
// ConnectorBypassMutator. A name that matches no mutator selects nothing; the
// caller warns about it, as the Apex command does.
const normalize = (name: string): string => {
  const lower = name.trim().toLowerCase()
  return lower.endsWith(MUTATOR_SUFFIX)
    ? lower.slice(0, -MUTATOR_SUFFIX.length)
    : lower
}

// One parse, every mutator over it: generation is linear in the size of the
// flow. A mutant keeps its edits, not a mutated copy of the document; it is
// located — for the report and for --lines — by its anchor, the part of the
// flow it changes, not by whichever edit happens to come first. An element
// only the Async Path reaches gets no mutant: no FlowTest runs it.
export class FlowMutantGenerator {
  constructor(
    private readonly mutators: FlowMutator[] = getDefaultFlowMutators()
  ) {}

  public generate(
    dom: FlowXmlDom,
    allowedLines?: Set<number>,
    filter?: FlowMutatorFilter
  ): FlowMutant[] {
    const { asyncOnlyElements } = analyzeFlowPaths(dom)
    return this.select(filter)
      .flatMap(mutator => mutator.mutate(dom))
      .filter(mutation => !asyncOnlyElements.has(mutation.elementName))
      .map(mutation => ({
        mutation,
        location: {
          start: dom.positionAt(mutation.anchor.start),
          end: dom.positionAt(mutation.anchor.end),
        },
      }))
      .filter(
        ({ location }) => !allowedLines || allowedLines.has(location.start.line)
      )
      .map(({ mutation, location }, index) => ({
        ...mutation,
        id: `FLOW-MUT-${index + 1}`,
        status: 'Pending' as const,
        location,
      }))
  }

  // True only when the filter removes at least one mutator: a list of names
  // that match nothing leaves every mutator, so it is never blamed for an
  // empty mutant set.
  public narrows(filter?: FlowMutatorFilter): boolean {
    return this.select(filter).length < this.mutators.length
  }

  public selectsAny(filter: FlowMutatorFilter): boolean {
    return this.select(filter).length > 0
  }

  // The names in the filter that no mutator answers to, as given, each once
  // whatever its spelling.
  public unknownNames(filter: FlowMutatorFilter): string[] {
    const known = new Set(this.mutators.map(mutator => normalize(mutator.name)))
    const { include, exclude } = filter
    const unknown = (include ?? exclude ?? []).filter(
      name => !known.has(normalize(name))
    )
    return unknown.filter(
      (name, index) =>
        unknown.findIndex(other => normalize(other) === normalize(name)) ===
        index
    )
  }

  // An absent filter and one whose list is empty both select every mutator,
  // as in the Apex command.
  private select(filter?: FlowMutatorFilter): FlowMutator[] {
    const { include, exclude } = filter ?? {}
    const names = include ?? exclude
    if (!names || names.length === 0) {
      return this.mutators
    }
    const wanted = new Set(names.map(normalize))
    const isInclude = include !== undefined
    return this.mutators.filter(
      mutator => isInclude === wanted.has(normalize(mutator.name))
    )
  }
}
