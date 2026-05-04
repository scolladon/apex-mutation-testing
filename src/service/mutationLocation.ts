import { ApexMutation } from '../type/ApexMutation.js'

// Advance a 1-indexed (line, column) cursor through `text`, returning the
// position immediately AFTER the last character. Handles tokens whose text
// spans newlines (multi-line string literals, block comments).
//
// Used to compute the Stryker `end` position for a mutation: ANTLR tokens
// expose `line` and `charPositionInLine` for the START of the token but not
// past the end; walking `endToken.text` closes that gap without needing a
// separate line-offset index over the whole source.
const advancePosition = (
  text: string,
  startLine: number,
  startColumn: number
): { line: number; column: number } => {
  let line = startLine
  let column = startColumn
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) {
      line++
      column = 1
    } else {
      column++
    }
  }
  return { line, column }
}

export const calculateMutationPosition = (
  mutation: ApexMutation
): {
  start: { line: number; column: number }
  end: { line: number; column: number }
} => {
  const start = mutation.target.startToken
  const end = mutation.target.endToken

  if (
    start.startIndex === undefined ||
    end.stopIndex === undefined ||
    end.text === undefined
  ) {
    throw new Error(
      `Failed to calculate position for mutation: ${mutation.mutationName}`
    )
  }

  // ANTLR tokens expose the position of the FIRST character directly.
  // The Stryker `end` position is exclusive (one past the last char), so
  // we walk endToken.text to advance from the end token's own start.
  // This correctly handles tokens that span newlines (multi-line string
  // literals, block comments).
  return {
    start: {
      line: start.line,
      column: start.charPositionInLine + 1,
    },
    end: advancePosition(end.text, end.line, end.charPositionInLine + 1),
  }
}

export const extractMutationOriginalText = (
  mutation: ApexMutation,
  sourceContent: string
): string => {
  const start = mutation.target.startToken
  const end = mutation.target.endToken

  if (
    start.startIndex !== undefined &&
    end.stopIndex !== undefined &&
    sourceContent
  ) {
    return sourceContent.substring(start.startIndex, end.stopIndex + 1)
  }

  throw new Error(
    `Failed to extract original text for mutation: ${mutation.mutationName}`
  )
}
