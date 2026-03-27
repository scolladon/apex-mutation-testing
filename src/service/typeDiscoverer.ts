import { ParserRuleContext } from 'antlr4ts'
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

// Apex catch clause grammar: catch ( ExceptionType varName ) block
// Indices from start: [0]=catch [1]=( [2]=ExceptionType [3]=varName [4]=) [5]=block
// Minimum 6 children; ExceptionType and varName are at fixed offsets from the end.
const CATCH_TYPE_OFFSET = 4 // ctx.children.length - 4 => ExceptionType
const CATCH_VAR_OFFSET = 3 // ctx.children.length - 3 => varName
const CATCH_MIN_CHILDREN = 6

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
    /* c8 ignore start -- defensive guard: parser always produces well-formed contexts */
    if (!ctx.children || ctx.children.length < 4) {
      return
    }
    /* c8 ignore stop */

    const returnType = ctx.children[0].text
    const methodName = ctx.children[1].text

    /* c8 ignore start -- defensive guard: parser always produces non-empty text */
    if (!returnType || !methodName) {
      return
    }
    /* c8 ignore stop */

    this.currentMethodName = methodName
    this.currentMethodVariables = new Map()

    const lowerReturnType = returnType.toLowerCase()
    let elementType: string | undefined

    if (
      lowerReturnType.startsWith('list<') ||
      lowerReturnType.startsWith('set<')
    ) {
      const match = returnType.match(/<(.+)>/)
      /* istanbul ignore next -- defensive guard: parser always produces well-formed generics */
      if (match?.[1]) {
        elementType = match[1]
      }
    } else if (lowerReturnType.startsWith('map<')) {
      const match = returnType.match(/<(.+),(.+)>/)
      /* istanbul ignore next -- defensive guard: parser always produces well-formed generics */
      if (match?.[1] && match[2]) {
        elementType = `${match[1]},${match[2]}`
      }
    } else if (returnType.endsWith('[]')) {
      elementType = returnType.substring(0, returnType.length - 2)
    }

    const type = classifyApexType(returnType, this.matchers)

    /* c8 ignore next -- defensive guard: parser always provides start/stop tokens */
    const startLine = ctx.start?.line || 0
    /* c8 ignore next -- defensive guard: parser always provides start/stop tokens */
    const endLine = ctx.stop?.line || 0

    const methodInfo: ApexMethod = {
      returnType,
      startLine,
      endLine,
      type,
    }

    if (elementType !== undefined) {
      methodInfo.elementType = elementType
    }

    this._methodTypeTable.set(methodName, methodInfo)
  }

  exitMethodDeclaration(_ctx: ParserRuleContext): void {
    /* istanbul ignore next -- defensive guard: exit always follows enter */
    if (this.currentMethodName) {
      this._variableScopes.set(
        this.currentMethodName,
        this.currentMethodVariables
      )
      this.currentMethodName = undefined
      this.currentMethodVariables = new Map()
    }
  }

  enterLocalVariableDeclaration(ctx: ParserRuleContext): void {
    this.trackVariableDeclaration(ctx, this.currentMethodVariables)
  }

  enterFormalParameter(ctx: ParserRuleContext): void {
    /* istanbul ignore next -- defensive guard: parser always produces well-formed contexts */
    if (ctx.children && ctx.children.length >= 2) {
      const typeName = ctx.children[ctx.children.length - 2].text
      const paramName = ctx.children[ctx.children.length - 1].text
      this.currentMethodVariables.set(paramName, typeName.toLowerCase())
      this.collectToMatchers(typeName)
    }
  }

  enterFieldDeclaration(ctx: ParserRuleContext): void {
    this.trackVariableDeclaration(ctx, this._classFields)
  }

  enterEnhancedForControl(ctx: ParserRuleContext): void {
    /* istanbul ignore next -- defensive guard: parser always produces well-formed contexts */
    if (ctx.children && ctx.children.length >= 2) {
      const typeName = ctx.children[0].text
      const varName = ctx.children[1].text
      this.currentMethodVariables.set(varName, typeName.toLowerCase())
      this.collectToMatchers(typeName)
    }
  }

  enterCatchClause(ctx: ParserRuleContext): void {
    /* istanbul ignore next -- defensive guard: parser always produces well-formed contexts */
    if (ctx.children && ctx.children.length >= CATCH_MIN_CHILDREN) {
      const typeName =
        ctx.children[ctx.children.length - CATCH_TYPE_OFFSET].text
      const varName = ctx.children[ctx.children.length - CATCH_VAR_OFFSET].text
      this.currentMethodVariables.set(varName, typeName.toLowerCase())
      this.collectToMatchers(typeName)
    }
  }

  private trackVariableDeclaration(
    ctx: ParserRuleContext,
    target: Map<string, string>
  ): void {
    /* istanbul ignore next -- defensive guard: parser always produces well-formed contexts */
    if (ctx.children && ctx.children.length >= 2) {
      const typeName = ctx.children[0].text
      this.collectToMatchers(typeName)
      for (let i = 1; i < ctx.children.length; i++) {
        const child = ctx.children[i]
        const childText = child.text
        if (childText !== ',' && childText !== '=') {
          const varName = childText.split('=')[0]
          target.set(varName, typeName.toLowerCase())
        }
      }
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
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('other', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const listener = new TypeDiscoverListener(this.matchers)

    ParseTreeWalker.DEFAULT.walk(
      listener as ApexParserListener,
      tree as ParserRuleContext
    )

    for (const matcher of this.matchers) {
      await matcher.populate?.()
    }

    return new TypeRegistry(
      listener.methodTypeTable,
      listener.variableScopes,
      listener.classFields,
      this.matchers
    )
  }
}
