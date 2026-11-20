import { DOMParser, type Element, type Node } from '@xmldom/xmldom'

export const SF_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata'

// A change to the source text, by character offsets into the original XML.
// Mutants and the org adapter both describe what they change this way rather
// than by re-serialising a DOM: a mutant then costs a few numbers instead of
// a full copy of the document, the XML is only built when it is deployed,
// and every byte the edit does not touch — indentation, entity spelling,
// the trailing newline — reaches the org exactly as it was retrieved.
export interface XmlEdit {
  start: number
  end: number
  replacement: string
}

export interface SourcePosition {
  line: number
  column: number
}

const ELEMENT_NODE = 1

const isElement = (node: Node): node is Element =>
  node.nodeType === ELEMENT_NODE

export const escapeXmlText = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const CDATA_OPEN = '<![CDATA['
const CDATA_CLOSE = ']]>'

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

// The text one entity reference (without its '&' and ';') stands for; an
// unknown one never reaches here, since the parser rejects the document.
const decodeEntity = (name: string): string =>
  name.startsWith('#')
    ? String.fromCodePoint(
        name[1] === 'x'
          ? Number.parseInt(name.slice(2), 16)
          : Number.parseInt(name.slice(1), 10)
      )
    : NAMED_ENTITIES[name]

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const applyEdits = (
  source: string,
  edits: readonly XmlEdit[]
): string => {
  const ordered = [...edits].sort((a, b) => b.start - a.start)
  let result = source
  let floor = source.length
  for (const edit of ordered) {
    if (edit.end > floor) {
      throw new Error('Overlapping XML edits cannot be applied together')
    }
    result =
      result.slice(0, edit.start) + edit.replacement + result.slice(edit.end)
    floor = edit.start
  }
  return result
}

// xmldom throws on a fatal error itself and only reports a recoverable one
// (an undefined entity, say); both make the document unusable here, so the
// first of either becomes the one error raised, under one prefix.
const parseRoot = (source: string): Element => {
  let recoverable: string | undefined
  let doc: ReturnType<DOMParser['parseFromString']>
  try {
    doc = new DOMParser({
      onError: (level, message) => {
        if (level === 'error') recoverable ??= message
      },
    }).parseFromString(source, 'text/xml')
  } catch (error: unknown) {
    // xmldom only ever throws its own ParseError, an Error subclass.
    throw new Error(`XML parsing failed: ${(error as Error).message}`)
  }
  if (recoverable !== undefined) {
    throw new Error(`XML parsing failed: ${recoverable}`)
  }
  return doc.documentElement as Element
}

// A parsed Salesforce metadata document that remembers where every element
// sits in its source text. Queries are namespace-aware and plain DOM walks —
// no XPath, so no element name is ever interpolated into a query string.
export class FlowXmlDom {
  public readonly root: Element
  private readonly lineStarts: number[]

  private constructor(public readonly source: string) {
    this.root = parseRoot(source)
    this.lineStarts = [0]
    for (
      let i = source.indexOf('\n');
      i !== -1;
      i = source.indexOf('\n', i + 1)
    ) {
      this.lineStarts.push(i + 1)
    }
  }

  public static parse(source: string): FlowXmlDom {
    return new FlowXmlDom(source)
  }

  public isRoot(localName: string): boolean {
    return (
      this.root.namespaceURI === SF_NAMESPACE &&
      this.root.localName === localName
    )
  }

  // Every element named `localName` below `scope`, in document order.
  public elements(localName: string, scope: Element = this.root): Element[] {
    return Array.from(scope.getElementsByTagNameNS(SF_NAMESPACE, localName))
  }

  // Only an element has a namespace: text, comment and CDATA nodes never
  // match it, so the one check is also the element check.
  public children(parent: Element, localName: string): Element[] {
    return Array.from(parent.childNodes).filter(
      (child): child is Element =>
        child.namespaceURI === SF_NAMESPACE &&
        (child as Element).localName === localName
    )
  }

  public child(parent: Element, localName: string): Element | undefined {
    return this.children(parent, localName)[0]
  }

  // The trimmed text of an element, or undefined when it has none.
  public text(element: Element | undefined): string | undefined {
    // Stryker disable next-line OptionalChaining: an element's textContent is
    // never null — only a document's is — so the second ?. never short-circuits.
    const value = element?.textContent?.trim()
    return value ? value : undefined
  }

  public childText(parent: Element, localName: string): string | undefined {
    return this.text(this.child(parent, localName))
  }

  public positionAt(offset: number): SourcePosition {
    let low = 0
    // Stryker disable next-line ArithmeticOperator: a bound past the last line
    // reads lineStarts as undefined, which compares false like any start
    // beyond the offset, so the search converges on the same line.
    let high = this.lineStarts.length - 1
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (this.lineStarts[mid] <= offset) low = mid
      else high = mid - 1
    }
    return { line: low + 1, column: offset - this.lineStarts[low] + 1 }
  }

  // The element's own span in the source, from its '<' to one past its
  // closing '>'.
  public spanOf(element: Element): { start: number; end: number } {
    return { start: this.startOf(element), end: this.endOf(element) }
  }

  // Where each character of a leaf element's text sits in the source: entry
  // i is the offset of the i-th character of its textContent, the last entry
  // one past the end. Entities, CDATA and CRLF line ends spell a character
  // with more than one source character, so a position in the text is not a
  // fixed distance from the element's start. Undefined when the text cannot
  // be mapped back character by character.
  public textOffsets(element: Element): number[] | undefined {
    const start = this.source.indexOf('>', this.startOf(element)) + 1
    // A self-closing element has no text: its one offset is where it ends.
    if (this.source[start - 2] === '/') return [start]
    const end = this.source.lastIndexOf('</', this.endOf(element) - 1)
    const offsets: number[] = []
    let decoded = ''
    let at = start
    while (at < end) {
      if (this.source.startsWith(CDATA_OPEN, at)) {
        const close = this.source.indexOf(CDATA_CLOSE, at)
        for (let i = at + CDATA_OPEN.length; i < close; i++) {
          offsets.push(i)
          // A CRLF reads as one LF inside CDATA too.
          if (this.source.startsWith('\r\n', i)) {
            decoded += '\n'
            i++
          } else {
            decoded += this.source[i]
          }
        }
        at = close + CDATA_CLOSE.length
      } else if (this.source[at] === '&') {
        const semicolon = this.source.indexOf(';', at)
        const character = decodeEntity(this.source.slice(at + 1, semicolon))
        for (let unit = 0; unit < character.length; unit++) offsets.push(at)
        decoded += character
        at = semicolon + 1
      } else if (this.source.startsWith('\r\n', at)) {
        offsets.push(at)
        decoded += '\n'
        at += 2
      } else {
        offsets.push(at)
        decoded += this.source[at]
        at++
      }
    }
    offsets.push(end)
    return decoded === element.textContent ? offsets : undefined
  }

  // Replaces the whole text content of a leaf element. A self-closing
  // element is rewritten with an explicit close tag so it can hold the text.
  public replaceTextEdit(element: Element, text: string): XmlEdit {
    if (Array.from(element.childNodes).some(isElement)) {
      throw new Error(`<${element.tagName}> is not a leaf element`)
    }
    const start = this.startOf(element)
    const openEnd = this.source.indexOf('>', start)
    if (this.source[openEnd - 1] === '/') {
      return {
        start,
        end: openEnd + 1,
        replacement: `<${element.tagName}>${escapeXmlText(text)}</${element.tagName}>`,
      }
    }
    const end = this.endOf(element)
    return {
      start: openEnd + 1,
      end: this.source.lastIndexOf('</', end - 1),
      replacement: escapeXmlText(text),
    }
  }

  // Removes an element, together with its own line when it sits alone on it.
  public removeElementEdit(element: Element): XmlEdit {
    const { start, end } = this.lineSpanOf(element)
    return { start, end, replacement: '' }
  }

  // Inserts `fragment` as a child of `parent` named `localName`, before the
  // first existing child whose name sorts after it. Salesforce metadata
  // types list their fields alphabetically and the Metadata API validates
  // that order, so this is the position a retrieve would have produced.
  public insertChildEdit(
    parent: Element,
    localName: string,
    fragment: string
  ): XmlEdit {
    // Stryker disable next-line MethodExpression: a text or comment node has
    // no localName, and undefined never sorts after a name.
    const next = Array.from(parent.childNodes)
      .filter(isElement)
      .find(child => (child.localName as string) > localName)
    if (next) {
      const { start } = this.lineSpanOf(next)
      const indent = this.source.slice(start, this.startOf(next))
      return { start, end: start, replacement: `${indent}${fragment}\n` }
    }
    const end = this.endOf(parent)
    const closeStart = this.source.lastIndexOf('</', end - 1)
    return {
      start: closeStart,
      end: closeStart,
      replacement: `    ${fragment}\n`,
    }
  }

  // xmldom records the source position of every node it parses.
  private startOf(node: Node): number {
    const line = node.lineNumber as number
    const column = node.columnNumber as number
    return this.lineStarts[line - 1] + column - 1
  }

  // Offset one past the element's closing '>'.
  private endOf(element: Element): number {
    const start = this.startOf(element)
    const openEnd = this.source.indexOf('>', start)
    if (this.source[openEnd - 1] === '/') {
      return openEnd + 1
    }
    // A comment or a CDATA section may spell the tag without being one: it
    // is matched whole, and skipped.
    const tag = new RegExp(
      `<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|<(/?)${escapeRegExp(element.tagName)}(?=[\\s/>])`,
      'g'
    )
    // Stryker disable next-line ArithmeticOperator: the characters just before
    // an open tag's '>' are its name, attributes or '/', never a '<', so the
    // search finds the same next tag from either side of it.
    tag.lastIndex = openEnd + 1
    let depth = 1
    for (;;) {
      // Never null: the parser has already rejected an unclosed element.
      const match = tag.exec(this.source) as RegExpExecArray
      if (match[0].startsWith('<!')) continue
      const tagEnd = this.source.indexOf('>', match.index)
      if (match[1]) {
        depth--
        if (depth === 0) return tagEnd + 1
      } else if (this.source[tagEnd - 1] !== '/') {
        depth++
      }
    }
  }

  private lineSpanOf(element: Element): { start: number; end: number } {
    const start = this.startOf(element)
    const end = this.endOf(element)
    // Stryker disable next-line ArithmeticOperator: the character after an
    // element's '<' is its name, never a newline, so searching back from
    // either side of the '<' finds the same newline.
    const lineStart = this.source.lastIndexOf('\n', start - 1) + 1
    const lineEnd = this.source.indexOf('\n', end)
    const aloneOnLine =
      this.source.slice(lineStart, start).trim() === '' &&
      lineEnd !== -1 &&
      this.source.slice(end, lineEnd).trim() === ''
    return aloneOnLine ? { start: lineStart, end: lineEnd + 1 } : { start, end }
  }
}
