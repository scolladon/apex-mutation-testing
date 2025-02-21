import { BoundaryConditionMutator } from './mutator/boundaryConditionMutator.js'
import { IncrementMutator } from './mutator/incrementMutator.js'
import { MutationListener } from './mutator/mutationListener.js'

import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'

import { TokenStreamRewriter } from 'antlr4ts'

export class MutantGenerator {
  private tokenStream?: CommonTokenStream
  public compute(classContent: string) {
    const lexer = new ApexLexer(
      new CaseInsensitiveInputStream('other', classContent)
    )
    this.tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(this.tokenStream)
    const tree = parser.compilationUnit()

    const incrementListener = new IncrementMutator()
    const boundaryListener = new BoundaryConditionMutator()

    const listener = new MutationListener([incrementListener, boundaryListener])

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)

    return listener.getMutations()
  }

  public getMutatedVersion(mutation: any) {
    const [_mutatorClass, token, replacementText] = mutation
    // Create a new token stream rewriter
    const rewriter = new TokenStreamRewriter(this.tokenStream!)
    // Apply the mutation by replacing the original token with the replacement text
    rewriter.replace(
      token.symbol.tokenIndex,
      token.symbol.tokenIndex,
      replacementText
    )

    // Get the mutated code
    return rewriter.getText()
  }
}
