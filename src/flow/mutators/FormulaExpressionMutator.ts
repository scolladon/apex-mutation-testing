import type { FlowMutant, FlowMutator } from '../types.js'
import { FlowXmlDom } from '../xml/FlowXmlDom.js'

export class FormulaExpressionMutator implements FlowMutator {
  public readonly name = 'FormulaExpressionMutator'

  public mutate(xmlContent: string): Omit<FlowMutant, 'id' | 'status'>[] {
    const results: Omit<FlowMutant, 'id' | 'status'>[] = []
    const baseDom = FlowXmlDom.parse(xmlContent)
    const formulaNodes = baseDom.queryNodes('//sf:formulas')

    formulaNodes.forEach((formulaNode, formulaIndex) => {
      const formulaName =
        baseDom.getText('sf:name', formulaNode) ?? `Formula_${formulaIndex}`
      const exprText = baseDom.getText('sf:expression', formulaNode)

      if (!exprText) return

      // 1. Mutate non-empty string literals in single quotes: 'High' -> "''"
      const literalRegex = /'([^']+)'/g
      let match = literalRegex.exec(exprText)

      while (match !== null) {
        const fullMatch = match[0]
        const matchIndex = match.index
        const mutatedExpr =
          exprText.slice(0, matchIndex) +
          "''" +
          exprText.slice(matchIndex + fullMatch.length)

        const clonedDom = FlowXmlDom.parse(xmlContent)
        const targetFormula =
          clonedDom.queryNodes('//sf:formulas')[formulaIndex]
        const targetExprNode = clonedDom.queryNodes(
          'sf:expression',
          targetFormula
        )[0]
        targetExprNode.textContent = mutatedExpr

        const line = (targetExprNode as unknown as { lineNumber?: number })
          .lineNumber

        results.push({
          mutatorName: this.name,
          elementName: formulaName,
          lineNumber: line,
          description: `Replaced string literal ${fullMatch} with '' in formula '${formulaName}'`,
          originalSnippet: fullMatch,
          mutatedSnippet: "''",
          mutatedXml: clonedDom.serialize(),
        })

        match = literalRegex.exec(exprText)
      }

      // 2. Mutate binary comparison/logical operators (&& <-> ||, == <-> !=)
      const operatorPairs: Array<[string, string]> = [
        ['&&', '||'],
        ['||', '&&'],
        ['==', '!='],
        ['!=', '=='],
      ]

      for (const [opFrom, opTo] of operatorPairs) {
        let opIndex = exprText.indexOf(opFrom)
        while (opIndex !== -1) {
          const mutatedExpr =
            exprText.slice(0, opIndex) +
            opTo +
            exprText.slice(opIndex + opFrom.length)

          const clonedDom = FlowXmlDom.parse(xmlContent)
          const targetFormula =
            clonedDom.queryNodes('//sf:formulas')[formulaIndex]
          const targetExprNode = clonedDom.queryNodes(
            'sf:expression',
            targetFormula
          )[0]
          targetExprNode.textContent = mutatedExpr

          const line = (targetExprNode as unknown as { lineNumber?: number })
            .lineNumber

          results.push({
            mutatorName: this.name,
            elementName: formulaName,
            lineNumber: line,
            description: `Replaced operator '${opFrom}' with '${opTo}' in formula '${formulaName}'`,
            originalSnippet: opFrom,
            mutatedSnippet: opTo,
            mutatedXml: clonedDom.serialize(),
          })

          opIndex = exprText.indexOf(opFrom, opIndex + opFrom.length)
        }
      }
    })

    return results
  }
}
