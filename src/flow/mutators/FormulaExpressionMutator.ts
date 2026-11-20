import type { FlowMutation, FlowMutator } from '../types.js'
import { escapeXmlText, type FlowXmlDom } from '../xml/FlowXmlDom.js'

const OPERATOR_SWAPS = new Map<string, string>([
  ['&&', '||'],
  ['||', '&&'],
  ['==', '!='],
  ['!=', '=='],
])

// A formula comment changes nothing the flow does: nothing in it is a token.
const COMMENT_OPEN = '/*'
const COMMENT_CLOSE = '*/'

// One mutable token of a formula: where it is, what it reads, what it reads
// once mutated, and how a description names that change.
interface Token {
  start: number
  end: number
  text: string
  replacement: string
  change: string
}

// The literals and operators of a formula, in order. A literal is quoted
// with ' or " and may escape its quote with a backslash; an empty one has
// nothing to empty and is not a token. A merge field ({!…}) is skipped
// whole, so neither an operator inside a literal nor a quote inside a merge
// field is ever taken for what it is not. A comment (/* … */) is skipped
// whole too. An unterminated literal ends the scan, and an unterminated
// comment runs to the end: the formula is invalid as it stands.
const tokenize = (text: string): Token[] => {
  const tokens: Token[] = []
  let at = 0
  // Stryker disable next-line EqualityOperator: one more pass at the end
  // reads no character, matches nothing and only steps past the end.
  while (at < text.length) {
    const character = text[at]
    if (character === "'" || character === '"') {
      let end = at + 1
      // Stryker disable next-line EqualityOperator: at the end, the missing
      // character differs from the quote, so the scan steps once more past
      // the end and stops on the same unterminated literal.
      while (end < text.length && text[end] !== character) {
        end += text[end] === '\\' ? 2 : 1
      }
      if (end >= text.length) break
      if (end > at + 1) {
        const literal = text.slice(at, end + 1)
        const emptied = `${character}${character}`
        tokens.push({
          start: at,
          end: end + 1,
          text: literal,
          replacement: emptied,
          change: `string literal ${literal} with ${emptied}`,
        })
      }
      at = end + 1
    } else if (text.startsWith('{!', at)) {
      const close = text.indexOf('}', at)
      at = close === -1 ? text.length : close + 1
    } else if (text.startsWith(COMMENT_OPEN, at)) {
      const close = text.indexOf(COMMENT_CLOSE, at + COMMENT_OPEN.length)
      at = close === -1 ? text.length : close + COMMENT_CLOSE.length
    } else {
      const operator = text.slice(at, at + 2)
      const swapped = OPERATOR_SWAPS.get(operator)
      if (swapped) {
        tokens.push({
          start: at,
          end: at + 2,
          text: operator,
          replacement: swapped,
          change: `operator '${operator}' with '${swapped}'`,
        })
        at += 2
      } else {
        at++
      }
    }
  }
  return tokens
}

// One mutant per non-empty literal (emptied) and per operator (swapped). The
// deployed edit rewrites the whole expression — a string the size of one
// formula — but the mutant is located at its token, and names which
// occurrence it is when the same token appears more than once.
export class FormulaExpressionMutator implements FlowMutator {
  public readonly name = 'FormulaExpressionMutator'

  public mutate(dom: FlowXmlDom): FlowMutation[] {
    return dom.elements('formulas').flatMap((formula, index) => {
      const formulaName = dom.childText(formula, 'name') ?? `Formula_${index}`
      const expression = dom.child(formula, 'expression')
      const offsets = expression && dom.textOffsets(expression)
      if (!expression || !offsets) return []
      const text = expression.textContent as string
      const tokens = tokenize(text)
      const counts = new Map<string, number>()
      for (const token of tokens) {
        counts.set(token.text, (counts.get(token.text) ?? 0) + 1)
      }
      const seen = new Map<string, number>()
      return tokens.map(token => {
        const occurrence = (seen.get(token.text) ?? 0) + 1
        seen.set(token.text, occurrence)
        const total = counts.get(token.text) as number
        const which = total > 1 ? ` (occurrence ${occurrence} of ${total})` : ''
        return {
          mutatorName: this.name,
          elementName: formulaName,
          description: `Replaced ${token.change}${which} in formula '${formulaName}'`,
          edits: [
            dom.replaceTextEdit(
              expression,
              text.slice(0, token.start) +
                token.replacement +
                text.slice(token.end)
            ),
          ],
          anchor: { start: offsets[token.start], end: offsets[token.end] },
          replacement: escapeXmlText(token.replacement),
        }
      })
    })
  }
}
