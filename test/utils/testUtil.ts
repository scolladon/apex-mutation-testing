import type { Progress, Spinner } from '@salesforce/sf-plugins-core'
import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import {
  DotMethodCallContext,
  ExpressionListContext,
  MethodDeclarationContext,
} from 'apex-parser'
import { vi } from 'vitest'
import type { ApexSourceProvider } from '../../src/port/apexSourceProvider.js'
import type {
  Baseline,
  MutationTestBed,
  PrepareHooks,
} from '../../src/port/mutationTestBed.js'
import type { SObjectSchemaProvider } from '../../src/port/sObjectSchemaProvider.js'
import type { TypeMatcher } from '../../src/service/typeMatcher.js'
import type { ApexClass } from '../../src/type/ApexClass.js'
import type { ApexMethod } from '../../src/type/ApexMethod.js'
import { TokenRange } from '../../src/type/ApexMutation.js'
import { TypeRegistry } from '../../src/type/TypeRegistry.js'

export type UiRecorder = {
  spinner: Spinner
  progress: Progress
  sink: (text: string) => void
  calls: string[]
}

// Records every spinner/progress/sink invocation as one rendered line, in
// call order. The rendered forms below are the vocabulary the golden arrays
// are written in; changing one invalidates every recorded array at once.
export const recordUiCalls = (): UiRecorder => {
  const calls: string[] = []
  const spinner = {
    start: vi.fn((text: string) => {
      calls.push(`spinner.start:${text}`)
    }),
    // Records the CALL, never the rendered text. oclif's real stop() prints
    // its default 'done' when a task is active and prints nothing at all when
    // none is, so a recorded textless `spinner.stop:` maps to either — the
    // arrays cannot tell those apart, and never pin the user-visible word.
    // Do not add rendering fidelity to this stub without re-capturing every
    // golden array.
    stop: vi.fn((text?: string) => {
      calls.push(`spinner.stop:${text ?? ''}`)
    }),
    // Models oclif's real pause(): runs the callback synchronously and never
    // no-ops when no task is running.
    pause: vi.fn((fn: () => void) => {
      calls.push('spinner.pause')
      fn()
    }),
  } as unknown as Spinner
  const progress = {
    start: vi.fn((total: number, payload: { info: string }) => {
      calls.push(`progress.start:${total}|${payload.info}`)
    }),
    update: vi.fn((value: number, payload: { info: string }) => {
      calls.push(`progress.update:${value}|${payload.info}`)
    }),
    finish: vi.fn((payload: { info: string }) => {
      calls.push(`progress.finish:${payload.info}`)
    }),
    stop: vi.fn(() => {
      calls.push('progress.stop')
    }),
  } as unknown as Progress
  const sink = vi.fn((text: string) => {
    calls.push(`sink:${text}`)
  })
  return { spinner, progress, sink, calls }
}

// A stand-in MutationTestBed whose prepare() fires the three hooks in the
// documented order before resolving with the given baseline —
// callers that need prepare to reject build their own custom implementation,
// since a rejecting prepare must decide for itself which hooks it fired.
// evaluate() defaults to a clean Passed/no-tests verdict so a caller that
// does not care about the mutation loop's outcome does not have to script
// one; callers asserting a specific verdict override `bed.evaluate` directly.
export const fakeTestBed = (baseline: Partial<Baseline> = {}) => {
  const prepare = vi.fn(
    async (
      _original: unknown,
      _perimeter: string[],
      hooks: PrepareHooks
    ): Promise<Baseline> => {
      hooks.onVerifying()
      hooks.onVerified()
      hooks.onBaselineStarting()
      return {
        outcome: 'Passed',
        testsRan: 1,
        compileFailures: [],
        otherFailureCount: 0,
        testMethodsPerLine: new Map(),
        fidelity: 'per-test',
        cost: { applyMs: 5000, runMs: 5000 },
        ...baseline,
      }
    }
  )
  const evaluate = vi.fn().mockResolvedValue({
    kind: 'executed',
    result: { outcome: 'Passed', tests: [] },
  })
  const restore = vi.fn().mockResolvedValue(undefined)
  // Typed as the port, not inferred: without the annotation the fake can drift
  // out of the contract the production bed implements and nothing notices,
  // because no script type-checks test/**.
  const bed: MutationTestBed = {
    prepare,
    evaluate,
    restore,
  }
  return Object.assign(bed, { prepare, evaluate, restore })
}

// A stand-in ApexSourceProvider with every method pre-stubbed to a harmless
// default (an existing, empty-shaped class with no dependencies and no
// perimeter/suite fallout) so a caller only overrides the methods its test
// actually drives.
export const fakeSourceProvider = (
  overrides: Partial<ApexSourceProvider> = {}
) => ({
  classExists: vi.fn().mockResolvedValue(true),
  readClass: vi.fn().mockResolvedValue({} as ApexClass),
  listDependencies: vi
    .fn()
    .mockResolvedValue({ apexClasses: [], sObjects: [] }),
  assessPerimeter: vi.fn().mockResolvedValue({ skipped: [], resolutions: [] }),
  readTestSuiteMembers: vi.fn().mockResolvedValue([]),
  readExistingTestSuiteNames: vi.fn().mockResolvedValue([]),
  ...overrides,
})

// A stand-in SObjectSchemaProvider whose describe() is a no-op and whose
// lookups report "unknown" by default — the shape TypeDiscoverer sees when
// nothing in a class body resolves to an sObject.
export const fakeSchemaProvider = (
  overrides: Partial<SObjectSchemaProvider> = {}
) => ({
  describe: vi.fn().mockResolvedValue(undefined),
  resolveFieldType: vi.fn().mockReturnValue(undefined),
  ...overrides,
})

export const TestUtil = {
  createToken(line: number = 1, column: number = 0): Token {
    return {
      line,
      charPositionInLine: column,
      tokenIndex: 0,
      text: '',
      type: 0,
      channel: 0,
      startIndex: 0,
      stopIndex: 0,
      inputStream: null,
    } as unknown as Token
  },

  createTokenRange(
    text: string,
    line: number = 1,
    column: number = 0
  ): TokenRange {
    return {
      startToken: this.createToken(line, column),
      endToken: this.createToken(line, column + text.length),
      text,
    }
  },

  createExpressionNode(expression: string): ParserRuleContext {
    const node = {
      text: expression,
      start: this.createToken(1, 7), // After "return "
      stop: this.createToken(1, 7 + expression.length),
      childCount: 0,
      parent: null,
      children: [],
      getChild: (_i: number) => null,
      accept: (_visitor: unknown) => null,
    } as unknown as ParserRuleContext

    Object.setPrototypeOf(node, ParserRuleContext.prototype)

    return node
  },

  createReturnStatement(expression: string): ParserRuleContext {
    const expressionNode = this.createExpressionNode(expression)

    return {
      children: [{ text: 'return' }, expressionNode],
      childCount: 2,
      getChild: (i: number) => (i === 0 ? { text: 'return' } : expressionNode),
    } as unknown as ParserRuleContext
  },

  returnWithExpression(expression: string): ParserRuleContext {
    const expressionNode = this.createExpressionNode(expression)

    return {
      children: [{ text: 'return' }, expressionNode],
      childCount: 2,
      getChild: (i: number) => (i === 0 ? { text: 'return' } : expressionNode),
    } as unknown as ParserRuleContext
  },

  createMethodDeclaration(
    returnType: string,
    methodName: string
  ): ParserRuleContext {
    return {
      children: [
        { text: returnType },
        { text: methodName },
        { text: '(' },
        { text: ')' },
      ],
      childCount: 4,
      getChild: (i: number) => ({
        text: i === 0 ? returnType : i === 1 ? methodName : i === 2 ? '(' : ')',
      }),
    } as unknown as ParserRuleContext
  },

  createPreOpExpression(
    operator: string,
    innerExpression: string
  ): ParserRuleContext {
    const { TerminalNode } = require('antlr4ts/tree')

    const operatorNode = {
      text: operator,
      [Symbol.toStringTag]: 'TerminalNode',
    }
    Object.setPrototypeOf(operatorNode, TerminalNode.prototype)

    const innerNode = this.createExpressionNode(innerExpression)

    const node = {
      text: `${operator}${innerExpression}`,
      start: this.createToken(1, 7),
      stop: this.createToken(1, 7 + operator.length + innerExpression.length),
      childCount: 2,
      parent: null,
      children: [operatorNode, innerNode],
      getChild: (i: number) => (i === 0 ? operatorNode : innerNode),
      accept: (_visitor: unknown) => null,
      ruleIndex: -1,
    } as unknown as ParserRuleContext

    Object.setPrototypeOf(node, ParserRuleContext.prototype)

    return node
  },

  createReturnStatementWithPreOp(
    operator: string,
    innerExpression: string
  ): ParserRuleContext {
    const preOpNode = this.createPreOpExpression(operator, innerExpression)

    return {
      children: [{ text: 'return' }, preOpNode],
      childCount: 2,
      getChild: (i: number) => (i === 0 ? { text: 'return' } : preOpNode),
    } as unknown as ParserRuleContext
  },

  createComplexExpression(
    expression: string,
    childCount: number
  ): ParserRuleContext {
    const node = {
      text: expression,
      start: this.createToken(1, 7),
      stop: this.createToken(1, 7 + expression.length),
      childCount,
      parent: null,
      children: Array(childCount).fill({ text: 'child' }),
      getChild: (_i: number) => ({ text: 'child' }),
      accept: (_visitor: unknown) => null,
    } as unknown as ParserRuleContext

    Object.setPrototypeOf(node, ParserRuleContext.prototype)

    return node
  },

  createReturnStatementWithComplexExpression(
    expression: string,
    childCount: number
  ): ParserRuleContext {
    const expressionNode = this.createComplexExpression(expression, childCount)

    return {
      children: [{ text: 'return' }, expressionNode],
      childCount: 2,
      getChild: (i: number) => (i === 0 ? { text: 'return' } : expressionNode),
    } as unknown as ParserRuleContext
  },

  createLocalVariableDeclaration(
    type: string,
    varName: string
  ): ParserRuleContext {
    return {
      children: [{ text: type }, { text: varName }],
      childCount: 2,
      start: this.createToken(1, 0),
    } as unknown as ParserRuleContext
  },

  createFormalParameter(type: string, paramName: string): ParserRuleContext {
    return {
      children: [{ text: type }, { text: paramName }],
      childCount: 2,
      start: this.createToken(1, 0),
    } as unknown as ParserRuleContext
  },

  createFieldDeclaration(type: string, fieldName: string): ParserRuleContext {
    return {
      children: [{ text: type }, { text: fieldName }],
      childCount: 2,
      start: this.createToken(1, 0),
    } as unknown as ParserRuleContext
  },

  createEnhancedForControl(type: string, varName: string): ParserRuleContext {
    return {
      children: [{ text: type }, { text: varName }],
      childCount: 2,
      start: this.createToken(1, 0),
    } as unknown as ParserRuleContext
  },

  createArithmeticExpression(
    left: string,
    operator: string,
    right: string
  ): ParserRuleContext {
    const operatorNode = new TerminalNode({ text: operator } as Token)
    const leftNode = { text: left }
    const rightNode = { text: right }

    return {
      childCount: 3,
      children: [leftNode, operatorNode, rightNode],
      getChild: (index: number) => {
        if (index === 0) return leftNode
        if (index === 1) return operatorNode
        return rightNode
      },
    } as unknown as ParserRuleContext
  },

  createTypeRegistry(
    methodTypeTable: Map<string, ApexMethod> = new Map(),
    variableScopes: Map<string, Map<string, string>> = new Map(),
    classFields: Map<string, string> = new Map(),
    matchers: TypeMatcher[] = []
  ): TypeRegistry {
    return new TypeRegistry(
      methodTypeTable,
      variableScopes,
      classFields,
      matchers
    )
  },

  createArgNode(text: string): ParserRuleContext {
    const node = {
      text,
      childCount: 0,
      children: [],
    } as unknown as ParserRuleContext
    Object.setPrototypeOf(node, ParserRuleContext.prototype)
    return node
  },

  createExpressionListCtx(args: ParserRuleContext[]): ParserRuleContext {
    const commaInterleaved: unknown[] = []
    args.forEach((arg, i) => {
      commaInterleaved.push(arg)
      if (i < args.length - 1) {
        commaInterleaved.push({ text: ',' })
      }
    })

    const node = Object.create(ExpressionListContext.prototype)
    Object.defineProperty(node, 'children', {
      value: commaInterleaved,
      writable: true,
      configurable: true,
    })
    return node as ParserRuleContext
  },

  createDotMethodCallCtx(
    methodName: string,
    args?: ParserRuleContext[]
  ): ParserRuleContext {
    const expressionList =
      args && args.length > 0 ? this.createExpressionListCtx(args) : null
    const children: unknown[] = [
      { text: methodName },
      { text: '(' },
      ...(expressionList ? [expressionList] : []),
      { text: ')' },
    ]

    const node = Object.create(DotMethodCallContext.prototype)
    Object.defineProperty(node, 'children', {
      value: children,
      writable: true,
      configurable: true,
    })
    return node as ParserRuleContext
  },

  createDotExpressionInMethod(
    receiverText: string,
    methodName: string,
    enclosingMethodName: string,
    args?: ParserRuleContext[]
  ): ParserRuleContext {
    const dotMethodCall = this.createDotMethodCallCtx(methodName, args)

    const ctx = {
      children: [{ text: receiverText }, { text: '.' }, dotMethodCall],
      childCount: 3,
      text: `${receiverText}.${methodName}(${args ? args.map(a => a.text).join(',') : ''})`,
      start: this.createToken(1, 0),
      stop: this.createToken(1, 30),
    } as unknown as ParserRuleContext

    const methodCtx = Object.create(MethodDeclarationContext.prototype)
    methodCtx.children = [
      { text: 'void' },
      { text: enclosingMethodName },
      { text: '(' },
      { text: ')' },
    ]
    Object.defineProperty(ctx, 'parent', {
      value: methodCtx,
      writable: true,
      configurable: true,
    })
    return ctx
  },

  createMethodCallExpressionInMethod(
    methodName: string,
    args: ParserRuleContext[],
    enclosingMethodName: string
  ): ParserRuleContext {
    const expressionList =
      args.length > 0 ? this.createExpressionListCtx(args) : null
    const methodCallChildren: unknown[] = [
      { text: methodName },
      { text: '(' },
      ...(expressionList ? [expressionList] : []),
      { text: ')' },
    ]
    const methodCall = {
      children: methodCallChildren,
      childCount: methodCallChildren.length,
    } as unknown as ParserRuleContext
    Object.setPrototypeOf(methodCall, ParserRuleContext.prototype)

    const ctx = {
      childCount: 1,
      text: `${methodName}(${args.map(a => a.text).join(',')})`,
      start: this.createToken(1, 0),
      stop: this.createToken(1, 20),
      getChild: (index: number) => (index === 0 ? methodCall : null),
    } as unknown as ParserRuleContext

    const methodCtx = Object.create(MethodDeclarationContext.prototype)
    methodCtx.children = [
      { text: 'void' },
      { text: enclosingMethodName },
      { text: '(' },
      { text: ')' },
    ]
    Object.defineProperty(ctx, 'parent', {
      value: methodCtx,
      writable: true,
      configurable: true,
    })
    return ctx
  },

  setParent(child: ParserRuleContext, parent: ParserRuleContext): void {
    Object.defineProperty(child, 'parent', {
      value: parent,
      writable: true,
      configurable: true,
    })
  },
}
