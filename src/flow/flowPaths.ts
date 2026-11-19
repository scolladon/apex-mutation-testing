import type { Element } from '@xmldom/xmldom'
import type { FlowXmlDom } from './xml/FlowXmlDom.js'

const ASYNC_PATH_TYPE = 'AsyncAfterCommit'

// The paths a record-triggered flow can take after its start, as far as
// FlowTests are concerned: they run the immediate path and every Scheduled
// Path, never the Async Path.
export interface FlowPaths {
  hasScheduledPath: boolean
  hasAsyncPath: boolean
  // Elements reached only from the Async Path: no FlowTest runs them, so a
  // mutant there could never be killed.
  asyncOnlyElements: Set<string>
}

const targetOf = (dom: FlowXmlDom, scope: Element): string | undefined => {
  const connector = dom.child(scope, 'connector')
  return connector && dom.childText(connector, 'targetReference')
}

export const analyzeFlowPaths = (dom: FlowXmlDom): FlowPaths => {
  const start = dom.child(dom.root, 'start')
  const paths = start ? dom.children(start, 'scheduledPaths') : []
  const isAsync = (path: Element) =>
    dom.childText(path, 'pathType') === ASYNC_PATH_TYPE
  const asyncPaths = paths.filter(isAsync)

  // Every named element directly under the flow, with the elements its
  // connectors (outcomes, defaults, faults, loop exits…) lead to.
  const successors = new Map<string, string[]>()
  // A text node between elements has no <name> child, so it is skipped too.
  for (const element of Array.from(dom.root.childNodes)) {
    const name = dom.childText(element as Element, 'name')
    if (!name) continue
    successors.set(
      name,
      dom
        .elements('targetReference', element as Element)
        .map(reference => dom.text(reference))
        .filter((target): target is string => target !== undefined)
    )
  }
  const reachableFrom = (roots: (string | undefined)[]): Set<string> => {
    const reached = new Set<string>()
    const pending = roots.filter((root): root is string => root !== undefined)
    for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
      if (reached.has(name)) continue
      reached.add(name)
      pending.push(...(successors.get(name) ?? []))
    }
    return reached
  }

  const tested = reachableFrom([
    start && targetOf(dom, start),
    ...paths.filter(path => !isAsync(path)).map(path => targetOf(dom, path)),
  ])
  const asyncOnlyElements = new Set(
    [...reachableFrom(asyncPaths.map(path => targetOf(dom, path)))].filter(
      name => !tested.has(name)
    )
  )
  return {
    hasScheduledPath: paths.length > asyncPaths.length,
    hasAsyncPath: asyncPaths.length > 0,
    asyncOnlyElements,
  }
}
