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
  public compute(classContent: string) {
    const lexer = new ApexLexer(
      new CaseInsensitiveInputStream('other', classContent)
    )
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const incrementListener = new IncrementMutator()
    const boundaryListener = new BoundaryConditionMutator()

    const listener = new MutationListener([incrementListener, boundaryListener])

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)

    return listener.getMutations()
  }

  public getMutatedVersion(mutation: any) {
    const [mutatorClass, token, replacementText] = mutation
    // Create a new token stream for each mutation
    const mutatedLexer = new ApexLexer(
      new CaseInsensitiveInputStream('other', replacementText)
    )
    const mutatedTokenStream = new CommonTokenStream(mutatedLexer)
    //const mutatedParser = new ApexParser(mutatedTokenStream);
    //const mutatedTree = mutatedParser.compilationUnit();

    // Create a new token stream rewriter
    const rewriter = new TokenStreamRewriter(mutatedTokenStream)

    // Get the mutated code
    return rewriter.getText()
  }
}
