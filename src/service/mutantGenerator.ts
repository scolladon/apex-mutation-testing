import { BoundaryConditionMutator } from '../mutator/boundaryConditionMutator.js'
import { EmptyReturnMutator } from '../mutator/emptyReturnMutator.js'
import { IncrementMutator } from '../mutator/incrementMutator.js'
import { MutationListener } from '../mutator/mutationListener.js'
import { ApexTypeResolver } from './apexTypeResolver.js'

import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'

import { TokenStreamRewriter } from 'antlr4ts'
import { ApexMutation } from '../type/ApexMutation.js'

export class MutantGenerator {
  private tokenStream?: CommonTokenStream

  public compute(
    classContent: string,
    coveredLines: Set<number>,
    typeResolver?: ApexTypeResolver
  ) {
    const lexer = new ApexLexer(
      new CaseInsensitiveInputStream('other', classContent)
    )
    this.tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(this.tokenStream)
    const tree = parser.compilationUnit()

    const methodTypeTable = typeResolver
      ? typeResolver.analyzeMethodTypes(tree)
      : undefined

    const incrementListener = new IncrementMutator()
    const boundaryListener = new BoundaryConditionMutator()
    const emptyReturnListener = new EmptyReturnMutator()

    const listener = new MutationListener(
      [incrementListener, boundaryListener, emptyReturnListener],
      coveredLines,
      methodTypeTable
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)

    return listener.getMutations()
  }

  public mutate(mutation: ApexMutation) {
    // Create a new token stream rewriter
    const rewriter = new TokenStreamRewriter(this.tokenStream!)
    // Apply the mutation by replacing the original token with the replacement text
    rewriter.replace(
      mutation.token.symbol.tokenIndex,
      mutation.token.symbol.tokenIndex,
      mutation.replacement
    )

    // Get the mutated code
    return rewriter.getText()
  }
}
