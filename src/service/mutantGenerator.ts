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
import { TrueReturnMutator } from '../mutator/trueReturnMutator.js'
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
    const trueReturnListener = new TrueReturnMutator()

    const listener = new MutationListener(
      [
        incrementListener,
        boundaryListener,
        emptyReturnListener,
        trueReturnListener,
      ],
      coveredLines,
      methodTypeTable
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)

    return listener.getMutations()
  }

  public mutate(mutation: ApexMutation) {
    // Create a new token stream rewriter
    const rewriter = new TokenStreamRewriter(this.tokenStream!)

    if ('symbol' in mutation.target) {
      // Single token (Terminal Node)
      rewriter.replace(
        mutation.target.symbol.tokenIndex,
        mutation.target.symbol.tokenIndex,
        mutation.replacement
      )
    } else {
      // Expression
      rewriter.replace(
        mutation.target.startToken.tokenIndex,
        mutation.target.endToken.tokenIndex,
        mutation.replacement
      )
    }

    // Get the mutated code
    return rewriter.getText()
  }
}
