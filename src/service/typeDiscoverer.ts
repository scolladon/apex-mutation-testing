import { ParserRuleContext, type Token } from 'antlr4ts'
import type { ParseTree } from 'antlr4ts/tree/ParseTree.js'
import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import type { ApexMethod } from '../type/ApexMethod.js'
import { classifyApexType, TypeRegistry } from '../type/TypeRegistry.js'
import { TypeMatcher } from './typeMatcher.js'

/**
 * Result of a full parse + type analysis. The tree and tokenStream are
 * reused by MutantGenerator so we parse the class exactly once per run.
 */
export interface TypeAnalysisResult {
  typeRegistry: TypeRegistry
  tree: ParserRuleContext
  tokenStream: CommonTokenStream
}

// Apex catch clause grammar: catch ( ExceptionType varName ) block
// Indices from start: [0]=catch [1]=( [2]=ExceptionType [3]=varName [4]=) [5]=block
// ExceptionType and varName are at fixed offsets from the end.
const CATCH_TYPE_OFFSET = 4 // ctx.children.length - 4 => ExceptionType
const CATCH_VAR_OFFSET = 3 // ctx.children.length - 3 => varName

// Nesting delta for one character of a formal-parameter list, used to count
// top-level commas without descending into generics. Only angle brackets nest:
// the caller strips the outer parens, and an Apex formal parameter cannot
// contain a nested pair (no calls, no default values).
const delimiterDepthDelta = (ch: string): number => {
  if (ch === '<') return 1
  if (ch === '>') return -1
  return 0
}

// @ts-ignore: ANTLR listener implementing only the hooks we need
class TypeDiscoverListener implements ApexParserListener {
  private _methodTypeTable: Map<string, ApexMethod> = new Map()
  private _variableScopes: Map<string, Map<string, string>> = new Map()
  private _classFields: Map<string, string> = new Map()
  private currentMethodName: string | undefined
  private currentMethodVariables: Map<string, string> = new Map()

  constructor(private matchers: TypeMatcher[]) {}

  get methodTypeTable(): Map<string, ApexMethod> {
    return this._methodTypeTable
  }

  get variableScopes(): Map<string, Map<string, string>> {
    return this._variableScopes
  }

  get classFields(): Map<string, string> {
    return this._classFields
  }

  enterMethodDeclaration(ctx: ParserRuleContext): void {
    // apex-parser always emits exactly 4 children for a methodDeclaration
    // (typeRef, id, formalParameters, body), each with non-empty text.
    const children = ctx.children as ParseTree[]
    const returnType = children[0].text
    const methodName = children[1].text

    this.currentMethodName = methodName
    this.currentMethodVariables = new Map()

    const lowerReturnType = returnType.toLowerCase()
    let elementType: string | undefined

    if (
      lowerReturnType.startsWith('list<') ||
      lowerReturnType.startsWith('set<')
    ) {
      // Reached only when the return type already starts with `list<`/`set<`,
      // so the generic body is always present and non-empty.
      const match = returnType.match(/<(.+)>/) as RegExpMatchArray
      elementType = match[1]
    } else if (lowerReturnType.startsWith('map<')) {
      // Likewise: a parsed `map<K,V>` always yields both capture groups.
      const match = returnType.match(/<(.+),(.+)>/) as RegExpMatchArray
      elementType = `${match[1]},${match[2]}`
    } else if (returnType.endsWith('[]')) {
      elementType = returnType.substring(0, returnType.length - 2)
    }

    const type = classifyApexType(returnType, this.matchers)

    // A parsed context always carries start/stop tokens with a 1-based line.
    const methodInfo: ApexMethod = {
      returnType,
      startLine: ctx.start.line,
      endLine: (ctx.stop as Token).line,
      type,
    }

    if (elementType !== undefined) {
      methodInfo.elementType = elementType
    }

    // Key by name+arity so Apex overloads do not clobber one another.
    // Apex allows overloaded methods with identical names but different parameter counts;
    // keying by name alone caused the last-parsed overload to win silently.
    const arity = this.countFormalParameters(ctx)
    const key = `${methodName}/${arity}`
    this._methodTypeTable.set(key, methodInfo)

    // Preserve name-only lookup for callers that have no arity context.
    // Name-only lookup resolves to the first declared overload (deterministic).
    if (!this._methodTypeTable.has(methodName)) {
      this._methodTypeTable.set(methodName, methodInfo)
    }
  }

  private countFormalParameters(ctx: ParserRuleContext): number {
    // The formalParameters child is the only one wrapped in parentheses; ANTLR's
    // `.text` concatenates tokens with no whitespace, so it needs no trimming.
    const children = ctx.children as ParseTree[]
    const parameterList = children.find(child =>
      child.text.startsWith('(')
    ) as ParseTree
    const inner = parameterList.text.slice(1, -1)
    if (inner.length === 0) return 0

    // Crude param count — commas at depth 0 only.
    let depth = 0
    let count = 1
    // `i <= inner.length` reads one past the end, yielding `undefined`, which
    // matches no delimiter — the extra iteration cannot change `count`.
    // Stryker disable next-line EqualityOperator: bound is not observable.
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i]
      if (ch === ',' && depth === 0) {
        count++
        continue
      }
      // `depth` is only ever compared against 0, so negating every delta
      // preserves the top-level test.
      // Stryker disable next-line AssignmentOperator: sign of depth is not observable.
      depth += delimiterDepthDelta(ch)
    }
    return count
  }

  exitMethodDeclaration(_ctx: ParserRuleContext): void {
    // Exit always follows a matching enter, so the method name is always set.
    this._variableScopes.set(
      this.currentMethodName as string,
      this.currentMethodVariables
    )
    this.currentMethodName = undefined
    this.currentMethodVariables = new Map()
  }

  enterLocalVariableDeclaration(ctx: ParserRuleContext): void {
    this.trackVariableDeclaration(ctx, this.currentMethodVariables)
  }

  enterFormalParameter(ctx: ParserRuleContext): void {
    // A formalParameter always ends with the type and name pair; any leading
    // annotations or modifiers sit before them.
    const children = ctx.children as ParseTree[]
    const typeName = children[children.length - 2].text
    const paramName = children[children.length - 1].text
    this.currentMethodVariables.set(paramName, typeName.toLowerCase())
    this.collectToMatchers(typeName)
  }

  enterFieldDeclaration(ctx: ParserRuleContext): void {
    this.trackVariableDeclaration(ctx, this._classFields)
  }

  enterEnhancedForControl(ctx: ParserRuleContext): void {
    // An enhancedForControl always has 4 children: type, id, ':', expression.
    const children = ctx.children as ParseTree[]
    const typeName = children[0].text
    const varName = children[1].text
    this.currentMethodVariables.set(varName, typeName.toLowerCase())
    this.collectToMatchers(typeName)
  }

  enterCatchClause(ctx: ParserRuleContext): void {
    // A catchClause always has CATCH_MIN_CHILDREN children, with the exception
    // type and variable name at fixed offsets from the end.
    const children = ctx.children as ParseTree[]
    const typeName = children[children.length - CATCH_TYPE_OFFSET].text
    const varName = children[children.length - CATCH_VAR_OFFSET].text
    this.currentMethodVariables.set(varName, typeName.toLowerCase())
    this.collectToMatchers(typeName)
  }

  private trackVariableDeclaration(
    ctx: ParserRuleContext,
    target: Map<string, string>
  ): void {
    // ANTLR keeps the whole declarator list in ONE child (e.g. `x=5,y=6`), so
    // every child after the type contributes a name via split-on-equals.
    const children = ctx.children as ParseTree[]
    const typeName = children[0].text
    this.collectToMatchers(typeName)
    for (let i = 1; i < children.length; i++) {
      const varName = children[i].text.split('=')[0]
      target.set(varName, typeName.toLowerCase())
    }
  }

  private collectToMatchers(typeName: string): void {
    for (const matcher of this.matchers) {
      matcher.collect(typeName)
    }
  }
}

export class TypeDiscoverer {
  private matchers: TypeMatcher[] = []

  withMatcher(matcher: TypeMatcher): this {
    this.matchers.push(matcher)
    return this
  }

  async analyze(code: string): Promise<TypeRegistry> {
    const { typeRegistry } = await this.analyzeFull(code)
    return typeRegistry
  }

  async analyzeFull(code: string): Promise<TypeAnalysisResult> {
    // Stryker disable next-line StringLiteral: the stream name is a diagnostic
    // label only — apex-parser never surfaces it in tokens, tree, or errors here.
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('other', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit() as ParserRuleContext

    const listener = new TypeDiscoverListener(this.matchers)
    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)

    for (const matcher of this.matchers) {
      await matcher.populate?.()
    }

    const typeRegistry = new TypeRegistry(
      listener.methodTypeTable,
      listener.variableScopes,
      listener.classFields,
      this.matchers
    )

    return { typeRegistry, tree, tokenStream }
  }
}
