import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import * as xpath from 'xpath'

export const SF_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata'

type XmlDocument = ReturnType<DOMParser['parseFromString']>

export class FlowXmlDom {
  private readonly doc: XmlDocument
  private readonly select: xpath.XPathSelect

  private constructor(xmlContent: string) {
    this.doc = new DOMParser({
      onError: (_level, msg) => {
        throw new Error(`XML parsing failed: ${msg}`)
      },
    }).parseFromString(xmlContent, 'text/xml')
    this.select = xpath.useNamespaces({ sf: SF_NAMESPACE })
  }

  public static parse(xmlContent: string): FlowXmlDom {
    return new FlowXmlDom(xmlContent)
  }

  public getDocument(): XmlDocument {
    return this.doc
  }

  public queryNodes(xpathExpr: string, contextNode?: unknown): Node[] {
    const result = this.select(
      xpathExpr,
      (contextNode ?? this.doc) as unknown as Node
    )
    return result as unknown as Node[]
  }

  public getText(xpathExpr: string, contextNode?: unknown): string | undefined {
    const nodes = this.queryNodes(xpathExpr, contextNode)
    if (nodes.length === 0 || !nodes[0].firstChild) {
      return undefined
    }
    return nodes[0].textContent?.trim()
  }

  public serialize(): string {
    return new XMLSerializer().serializeToString(
      this.doc as unknown as Parameters<XMLSerializer['serializeToString']>[0]
    )
  }
}
