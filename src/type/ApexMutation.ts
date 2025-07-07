import { Token } from 'antlr4ts'
export interface TokenRange {
  startToken: Token
  endToken: Token
  text: string
}
export interface ApexMutation {
  mutationName: string
  target: TokenRange
  replacement: string
}
