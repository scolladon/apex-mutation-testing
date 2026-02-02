import { TokenStreamRewriter } from 'antlr4ts'
import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { ArithmeticOperatorMutator } from '../mutator/arithmeticOperatorMutator.js'
import { BoundaryConditionMutator } from '../mutator/boundaryConditionMutator.js'
import { ConstructorCallMutator } from '../mutator/constructorCallMutator.js'
import { EmptyReturnMutator } from '../mutator/emptyReturnMutator.js'
import { EqualityConditionMutator } from '../mutator/equalityConditionMutator.js'
import { FalseReturnMutator } from '../mutator/falseReturnMutator.js'
import { IncrementMutator } from '../mutator/incrementMutator.js'
import { InvertNegativesMutator } from '../mutator/invertNegativesMutator.js'
import { LogicalOperatorMutator } from '../mutator/logicalOperatorMutator.js'
import { MutationListener } from '../mutator/mutationListener.js'
import { NegationMutator } from '../mutator/negationMutator.js'
import { NullReturnMutator } from '../mutator/nullReturnMutator.js'
import { RemoveIncrementsMutator } from '../mutator/removeIncrementsMutator.js'
import { TrueReturnMutator } from '../mutator/trueReturnMutator.js'
import { VoidMethodCallMutator } from '../mutator/voidMethodCallMutator.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { ApexTypeResolver } from './apexTypeResolver.js'

export class MutantGenerator {
  private tokenStream?: CommonTokenStream

  public getTokenStream() {
    return this.tokenStream
  }

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

    const methodTypeTable = typeResolver?.analyzeMethodTypes(tree)

    const incrementListener = new IncrementMutator()
    const boundaryListener = new BoundaryConditionMutator()
    const emptyReturnListener = new EmptyReturnMutator()
    const trueReturnListener = new TrueReturnMutator()
    const falseReturnListener = new FalseReturnMutator()
    const nullReturnListener = new NullReturnMutator()
    const equalityListener = new EqualityConditionMutator()
    const arithmeticListener = new ArithmeticOperatorMutator()
    const invertNegativesListener = new InvertNegativesMutator()
    const logicalOperatorListener = new LogicalOperatorMutator()
    const negationListener = new NegationMutator()
    const removeIncrementsListener = new RemoveIncrementsMutator()
    const voidMethodCallListener = new VoidMethodCallMutator()
    const constructorCallListener = new ConstructorCallMutator()

    const listener = new MutationListener(
      [
        boundaryListener,
        incrementListener,
        equalityListener,
        emptyReturnListener,
        trueReturnListener,
        falseReturnListener,
        nullReturnListener,
        arithmeticListener,
        invertNegativesListener,
        logicalOperatorListener,
        negationListener,
        removeIncrementsListener,
        voidMethodCallListener,
        constructorCallListener,
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

    rewriter.replace(
      mutation.target.startToken.tokenIndex,
      mutation.target.endToken.tokenIndex,
      mutation.replacement
    )

    // Get the mutated code
    return rewriter.getText()
  }
}
