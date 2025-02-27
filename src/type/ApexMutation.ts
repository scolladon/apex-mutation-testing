import { TerminalNode } from 'antlr4ts/tree'

export interface ApexMutation {
  mutationName: string
  token: TerminalNode
  replacement: string
}
