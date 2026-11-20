import type { Element } from '@xmldom/xmldom'
import type { FlowXmlDom } from './xml/FlowXmlDom.js'

const ASYNC_PATH_TYPE = 'AsyncAfterCommit'

// The paths a record-triggered flow can take after its start, as far as
// FlowTests are concerned: they run the immediate path and every Scheduled
// Path, never the Async Path.
export interface FlowPaths {
  hasScheduledPath: boolean
  hasAsyncPath: boolean
  // Elements reached only from the Async Path, and the formulas only they
  // use: no FlowTest runs them, so a mutant there could never be killed.
  asyncOnlyElements: Set<string>
}

const ELEMENT_NODE = 1

// The resources that hold an expression naming other resources: a formula
// used only by another one, or by a text template, is used where they are.
const EXPRESSION_RESOURCES = new Set(['formulas', 'textTemplates'])

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The formulas only async-only elements use, directly or through other
// formulas and text templates. Who uses a formula is found by its name in the
// text of every other element of the flow, in any case and wherever it
// stands: a mention that is not a use (a description, a field of the same
// name) only ever keeps a formula's mutants, never drops them. A formula
// nothing mentions keeps its mutants too: unused, but not untested.
const asyncOnlyFormulas = (
  dom: FlowXmlDom,
  asyncOnlyElements: Set<string>
): string[] => {
  const top = Array.from(dom.root.childNodes)
    .filter((node): node is Element => node.nodeType === ELEMENT_NODE)
    .map(element => ({
      tag: element.localName as string,
      name: dom.childText(element, 'name'),
      text: dom.source.slice(
        dom.spanOf(element).start,
        dom.spanOf(element).end
      ),
    }))
  const usersOf = (name: string) => {
    const mention = new RegExp(
      `(?<![A-Za-z0-9_])${escapeRegExp(name)}(?![A-Za-z0-9_])`,
      'i'
    )
    return top.filter(entry => entry.name !== name && mention.test(entry.text))
  }
  // A name met again while its own verdict is pending is in a cycle: it is
  // not proven async-only, and neither is what depends on it — a verdict that
  // only ever keeps mutants, so it may be remembered like any other.
  const verdicts = new Map<string, boolean>()
  const isAsyncOnly = (name: string): boolean => {
    const known = verdicts.get(name)
    if (known !== undefined) return known
    verdicts.set(name, false)
    const users = usersOf(name)
    const verdict =
      users.length > 0 &&
      users.every(
        user =>
          user.name !== undefined &&
          (asyncOnlyElements.has(user.name) ||
            (EXPRESSION_RESOURCES.has(user.tag) && isAsyncOnly(user.name)))
      )
    verdicts.set(name, verdict)
    return verdict
  }
  return top
    .filter(entry => entry.tag === 'formulas' && entry.name !== undefined)
    .map(entry => entry.name as string)
    .filter(name => isAsyncOnly(name))
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
  for (const formula of asyncOnlyFormulas(dom, asyncOnlyElements)) {
    asyncOnlyElements.add(formula)
  }
  return {
    hasScheduledPath: paths.length > asyncPaths.length,
    hasAsyncPath: asyncPaths.length > 0,
    asyncOnlyElements,
  }
}
