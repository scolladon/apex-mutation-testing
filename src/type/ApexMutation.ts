import { Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'

export interface TokenRange {
  startToken: Token
  endToken: Token
  text: string
}
export interface ApexMutation {
  mutationName: string
  target: TerminalNode | TokenRange
  replacement: string
}
