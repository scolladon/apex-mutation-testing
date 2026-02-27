import { TokenStreamRewriter } from 'antlr4ts'
import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { ArgumentPropagationMutator } from '../mutator/argumentPropagationMutator.js'
import { ArithmeticOperatorDeletionMutator } from '../mutator/arithmeticOperatorDeletionMutator.js'
import { ArithmeticOperatorMutator } from '../mutator/arithmeticOperatorMutator.js'
import { BaseListener } from '../mutator/baseListener.js'
import { BitwiseOperatorMutator } from '../mutator/bitwiseOperatorMutator.js'
import { BoundaryConditionMutator } from '../mutator/boundaryConditionMutator.js'
import { ConstructorCallMutator } from '../mutator/constructorCallMutator.js'
import { EmptyReturnMutator } from '../mutator/emptyReturnMutator.js'
import { EqualityConditionMutator } from '../mutator/equalityConditionMutator.js'
import { ExperimentalSwitchMutator } from '../mutator/experimentalSwitchMutator.js'
import { FalseReturnMutator } from '../mutator/falseReturnMutator.js'
import { IncrementMutator } from '../mutator/incrementMutator.js'
import { InlineConstantMutator } from '../mutator/inlineConstantMutator.js'
import { InvertNegativesMutator } from '../mutator/invertNegativesMutator.js'
import { LogicalOperatorMutator } from '../mutator/logicalOperatorMutator.js'
import { MemberVariableMutator } from '../mutator/memberVariableMutator.js'
import { MutationListener } from '../mutator/mutationListener.js'
import { NakedReceiverMutator } from '../mutator/nakedReceiverMutator.js'
import { NegationMutator } from '../mutator/negationMutator.js'
import { NonVoidMethodCallMutator } from '../mutator/nonVoidMethodCallMutator.js'
import { NullReturnMutator } from '../mutator/nullReturnMutator.js'
import { RemoveConditionalsMutator } from '../mutator/removeConditionalsMutator.js'
import { RemoveIncrementsMutator } from '../mutator/removeIncrementsMutator.js'
import { SwitchMutator } from '../mutator/switchMutator.js'
import { TrueReturnMutator } from '../mutator/trueReturnMutator.js'
import { UnaryOperatorInsertionMutator } from '../mutator/unaryOperatorInsertionMutator.js'
import { VoidMethodCallMutator } from '../mutator/voidMethodCallMutator.js'
import { ApexMutation } from '../type/ApexMutation.js'
import { TypeRegistry } from '../type/TypeRegistry.js'
import type { RE2Instance } from './configReader.js'

const MUTATOR_NAME = {
  ARGUMENT_PROPAGATION: 'ArgumentPropagation',
  ARITHMETIC_OPERATOR: 'ArithmeticOperator',
  ARITHMETIC_OPERATOR_DELETION: 'ArithmeticOperatorDeletion',
  BITWISE_OPERATOR: 'BitwiseOperator',
  BOUNDARY_CONDITION: 'BoundaryCondition',
  CONSTRUCTOR_CALL: 'ConstructorCall',
  EMPTY_RETURN: 'EmptyReturn',
  EQUALITY_CONDITION: 'EqualityCondition',
  EXPERIMENTAL_SWITCH: 'ExperimentalSwitch',
  FALSE_RETURN: 'FalseReturn',
  INCREMENT: 'Increment',
  INLINE_CONSTANT: 'InlineConstant',
  INVERT_NEGATIVES: 'InvertNegatives',
  LOGICAL_OPERATOR: 'LogicalOperator',
  MEMBER_VARIABLE: 'MemberVariable',
  NAKED_RECEIVER: 'NakedReceiver',
  NEGATION: 'Negation',
  NON_VOID_METHOD_CALL: 'NonVoidMethodCall',
  NULL_RETURN: 'NullReturn',
  REMOVE_CONDITIONALS: 'RemoveConditionals',
  REMOVE_INCREMENTS: 'RemoveIncrements',
  SWITCH: 'Switch',
  TRUE_RETURN: 'TrueReturn',
  UNARY_OPERATOR_INSERTION: 'UnaryOperatorInsertion',
  VOID_METHOD_CALL: 'VoidMethodCall',
} as const

type MutatorName = (typeof MUTATOR_NAME)[keyof typeof MUTATOR_NAME]

interface MutatorRegistryEntry {
  name: MutatorName
  create: (typeRegistry?: TypeRegistry) => BaseListener
}

const MUTATOR_REGISTRY: MutatorRegistryEntry[] = [
  {
    name: MUTATOR_NAME.ARGUMENT_PROPAGATION,
    create: tr => new ArgumentPropagationMutator(tr),
  },
  {
    name: MUTATOR_NAME.ARITHMETIC_OPERATOR,
    create: tr => new ArithmeticOperatorMutator(tr),
  },
  {
    name: MUTATOR_NAME.ARITHMETIC_OPERATOR_DELETION,
    create: tr => new ArithmeticOperatorDeletionMutator(tr),
  },
  {
    name: MUTATOR_NAME.BITWISE_OPERATOR,
    create: () => new BitwiseOperatorMutator(),
  },
  {
    name: MUTATOR_NAME.BOUNDARY_CONDITION,
    create: () => new BoundaryConditionMutator(),
  },
  {
    name: MUTATOR_NAME.CONSTRUCTOR_CALL,
    create: () => new ConstructorCallMutator(),
  },
  {
    name: MUTATOR_NAME.EMPTY_RETURN,
    create: tr => new EmptyReturnMutator(tr),
  },
  {
    name: MUTATOR_NAME.EQUALITY_CONDITION,
    create: () => new EqualityConditionMutator(),
  },
  {
    name: MUTATOR_NAME.EXPERIMENTAL_SWITCH,
    create: () => new ExperimentalSwitchMutator(),
  },
  {
    name: MUTATOR_NAME.FALSE_RETURN,
    create: tr => new FalseReturnMutator(tr),
  },
  {
    name: MUTATOR_NAME.INCREMENT,
    create: () => new IncrementMutator(),
  },
  {
    name: MUTATOR_NAME.INLINE_CONSTANT,
    create: tr => new InlineConstantMutator(tr),
  },
  {
    name: MUTATOR_NAME.INVERT_NEGATIVES,
    create: () => new InvertNegativesMutator(),
  },
  {
    name: MUTATOR_NAME.LOGICAL_OPERATOR,
    create: () => new LogicalOperatorMutator(),
  },
  {
    name: MUTATOR_NAME.MEMBER_VARIABLE,
    create: () => new MemberVariableMutator(),
  },
  {
    name: MUTATOR_NAME.NAKED_RECEIVER,
    create: tr => new NakedReceiverMutator(tr),
  },
  {
    name: MUTATOR_NAME.NEGATION,
    create: tr => new NegationMutator(tr),
  },
  {
    name: MUTATOR_NAME.NON_VOID_METHOD_CALL,
    create: tr => new NonVoidMethodCallMutator(tr),
  },
  {
    name: MUTATOR_NAME.NULL_RETURN,
    create: tr => new NullReturnMutator(tr),
  },
  {
    name: MUTATOR_NAME.REMOVE_CONDITIONALS,
    create: () => new RemoveConditionalsMutator(),
  },
  {
    name: MUTATOR_NAME.REMOVE_INCREMENTS,
    create: () => new RemoveIncrementsMutator(),
  },
  {
    name: MUTATOR_NAME.SWITCH,
    create: () => new SwitchMutator(),
  },
  {
    name: MUTATOR_NAME.TRUE_RETURN,
    create: tr => new TrueReturnMutator(tr),
  },
  {
    name: MUTATOR_NAME.UNARY_OPERATOR_INSERTION,
    create: () => new UnaryOperatorInsertionMutator(),
  },
  {
    name: MUTATOR_NAME.VOID_METHOD_CALL,
    create: () => new VoidMethodCallMutator(),
  },
]

export class MutantGenerator {
  private tokenStream?: CommonTokenStream

  public getTokenStream() {
    return this.tokenStream
  }

  public compute(
    classContent: string,
    coveredLines: Set<number>,
    typeRegistry?: TypeRegistry,
    mutatorFilter?: { include?: string[]; exclude?: string[] },
    skipPatterns: RE2Instance[] = [],
    allowedLines?: Set<number>
  ) {
    const lexer = new ApexLexer(
      new CaseInsensitiveInputStream('other', classContent)
    )
    this.tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(this.tokenStream)
    const tree = parser.compilationUnit()

    const filteredRegistry = this.filterRegistry(mutatorFilter)

    const mutators = filteredRegistry.map(entry => entry.create(typeRegistry))
    const sourceLines = classContent.split('\n')

    const listener = new MutationListener(
      mutators,
      coveredLines,
      skipPatterns,
      allowedLines,
      sourceLines
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)

    return listener.getMutations()
  }

  public mutate(mutation: ApexMutation) {
    const rewriter = new TokenStreamRewriter(this.tokenStream!)

    rewriter.replace(
      mutation.target.startToken.tokenIndex,
      mutation.target.endToken.tokenIndex,
      mutation.replacement
    )

    return rewriter.getText()
  }

  private filterRegistry(mutatorFilter?: {
    include?: string[]
    exclude?: string[]
  }): MutatorRegistryEntry[] {
    if (!mutatorFilter) {
      return MUTATOR_REGISTRY
    }

    const names = mutatorFilter.include ?? mutatorFilter.exclude ?? []
    const nameSet = new Set(names.map(n => n.toLowerCase()))
    if (nameSet.size === 0) {
      return MUTATOR_REGISTRY
    }
    this.warnUnknownMutators(nameSet)

    const isInclude = Boolean(mutatorFilter.include)
    const filtered = MUTATOR_REGISTRY.filter(entry => {
      const match = nameSet.has(entry.name.toLowerCase())
      return isInclude ? match : !match
    })

    if (filtered.length === 0) {
      throw new Error('All mutators have been excluded by configuration')
    }

    return filtered
  }

  private warnUnknownMutators(requestedNames: Set<string>): void {
    const knownNames = new Set(MUTATOR_REGISTRY.map(e => e.name.toLowerCase()))
    for (const name of requestedNames) {
      if (!knownNames.has(name)) {
        process.emitWarning(`Unknown mutator name: '${name}' — skipping`)
      }
    }
  }
}
