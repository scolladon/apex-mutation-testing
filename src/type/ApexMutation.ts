import { Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'

export interface TokenRange {
  startToken: Token
  endToken: Token
  text: string
}

export type ReplacementTarget = TerminalNode | TokenRange

export interface ApexMutation {
  mutationName: string
  target: ReplacementTarget
  replacement: string
}
