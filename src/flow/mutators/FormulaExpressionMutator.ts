import type { FlowMutation, FlowMutator } from '../types.js'
import type { FlowXmlDom } from '../xml/FlowXmlDom.js'
import { textMutation } from './textMutation.js'

const OPERATOR_SWAPS: ReadonlyArray<readonly [string, string]> = [
  ['&&', '||'],
  ['||', '&&'],
  ['==', '!='],
  ['!=', '=='],
]

// Each occurrence of every pattern becomes its own mutant: the expression is
// rebuilt once per occurrence — a string the size of one formula, never a
// copy of the whole document.
export class FormulaExpressionMutator implements FlowMutator {
  public readonly name = 'FormulaExpressionMutator'

  public mutate(dom: FlowXmlDom): FlowMutation[] {
    return dom.elements('formulas').flatMap((formula, index) => {
      const formulaName = dom.childText(formula, 'name') ?? `Formula_${index}`
      const expression = dom.child(formula, 'expression')
      const text = dom.text(expression)
      if (!expression || !text) return []

      const replaceAt = (
        at: number,
        length: number,
        replacement: string,
        description: string
      ): FlowMutation =>
        textMutation(
          dom,
          expression,
          text.slice(0, at) + replacement + text.slice(at + length),
          { mutatorName: this.name, elementName: formulaName, description }
        )

      const literals = Array.from(text.matchAll(/'([^']+)'/g), match =>
        replaceAt(
          match.index,
          match[0].length,
          "''",
          `Replaced string literal ${match[0]} with '' in formula '${formulaName}'`
        )
      )
      const operators = OPERATOR_SWAPS.flatMap(([from, to]) =>
        occurrencesOf(text, from).map(at =>
          replaceAt(
            at,
            from.length,
            to,
            `Replaced operator '${from}' with '${to}' in formula '${formulaName}'`
          )
        )
      )
      return [...literals, ...operators]
    })
  }
}

const occurrencesOf = (text: string, token: string): number[] => {
  const found: number[] = []
  for (
    let at = text.indexOf(token);
    at !== -1;
    at = text.indexOf(token, at + token.length)
  ) {
    found.push(at)
  }
  return found
}
