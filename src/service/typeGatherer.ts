import { ParserRuleContext } from 'antlr4ts'
import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { ApexMethod, ApexType } from '../type/ApexMethod.js'
import { TypeMatcher } from './typeMatcher.js'

export interface TypeGatherResult {
  methodTypeTable: Map<string, ApexMethod>
  usedSObjectTypes: Set<string>
}

// @ts-ignore: ANTLR listener implementing only the hooks we need
class TypeGatherListener implements ApexParserListener {
  private _methodTypeTable: Map<string, ApexMethod> = new Map()
  private _collectedTypes: Set<string> = new Set()

  constructor(
    private apexClassMatcher: TypeMatcher,
    private sObjectMatcher: TypeMatcher
  ) {}

  get methodTypeTable(): Map<string, ApexMethod> {
    return this._methodTypeTable
  }

  get usedSObjectTypes(): Set<string> {
    return new Set(
      [...this._collectedTypes].filter(t => this.sObjectMatcher.matches(t))
    )
  }

  enterMethodDeclaration(ctx: ParserRuleContext): void {
    if (!ctx.children || ctx.children.length < 4) {
      return
    }

    const returnType = ctx.children[0].text
    const methodName = ctx.children[1].text

    if (!returnType || !methodName) {
      return
    }

    const lowerReturnType = returnType.toLowerCase()
    let elementType: string | undefined

    if (
      lowerReturnType.startsWith('list<') ||
      lowerReturnType.startsWith('set<')
    ) {
      const match = returnType.match(/<(.+)>/)
      if (match?.[1]) {
        elementType = match[1]
      }
    } else if (lowerReturnType.startsWith('map<')) {
      const match = returnType.match(/<(.+),(.+)>/)
      if (match?.[1] && match[2]) {
        elementType = `${match[1]},${match[2]}`
      }
    } else if (returnType.endsWith('[]')) {
      elementType = returnType.substring(0, returnType.length - 2)
    }

    const type = this.classifyType(returnType)

    const methodInfo: ApexMethod = {
      returnType,
      startLine: ctx.start?.line || 0,
      endLine: ctx.stop?.line || 0,
      type,
    }

    if (elementType !== undefined) {
      methodInfo.elementType = elementType
    }

    this._methodTypeTable.set(methodName, methodInfo)
  }

  enterLocalVariableDeclaration(ctx: ParserRuleContext): void {
    this.collectTypeFromDeclaration(ctx)
  }

  enterFieldDeclaration(ctx: ParserRuleContext): void {
    this.collectTypeFromDeclaration(ctx)
  }

  enterFormalParameter(ctx: ParserRuleContext): void {
    this.collectTypeFromDeclaration(ctx)
  }

  enterEnhancedForControl(ctx: ParserRuleContext): void {
    this.collectTypeFromDeclaration(ctx)
  }

  private collectTypeFromDeclaration(ctx: ParserRuleContext): void {
    if (!ctx.children || ctx.children.length < 1) {
      return
    }
    const typeName = ctx.children[0].text
    if (typeName) {
      this._collectedTypes.add(typeName)
    }
  }

  private classifyType(returnType: string): ApexType {
    const lowerReturnType = returnType.toLowerCase()

    if (lowerReturnType === 'void') return ApexType.VOID
    if (lowerReturnType === 'boolean') return ApexType.BOOLEAN
    if (lowerReturnType === 'integer') return ApexType.INTEGER
    if (lowerReturnType === 'long') return ApexType.LONG
    if (lowerReturnType === 'double') return ApexType.DOUBLE
    if (lowerReturnType === 'decimal') return ApexType.DECIMAL
    if (lowerReturnType === 'string') return ApexType.STRING
    if (lowerReturnType === 'id') return ApexType.ID
    if (lowerReturnType === 'blob') return ApexType.BLOB
    if (lowerReturnType === 'date') return ApexType.DATE
    if (lowerReturnType === 'datetime') return ApexType.DATETIME
    if (lowerReturnType === 'time') return ApexType.TIME
    if (lowerReturnType === 'sobject') return ApexType.SOBJECT
    if (lowerReturnType === 'object') return ApexType.OBJECT
    if (lowerReturnType.startsWith('list<') || returnType.endsWith('[]'))
      return ApexType.LIST
    if (lowerReturnType.startsWith('set<')) return ApexType.SET
    if (lowerReturnType.startsWith('map<')) return ApexType.MAP
    if (this.apexClassMatcher.matches(returnType)) return ApexType.APEX_CLASS
    if (this.sObjectMatcher.matches(returnType)) return ApexType.SOBJECT

    return ApexType.VOID
  }
}

export class TypeGatherer {
  constructor(
    private apexClassMatcher: TypeMatcher,
    private sObjectMatcher: TypeMatcher
  ) {}

  analyze(code: string): TypeGatherResult {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('other', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const listener = new TypeGatherListener(
      this.apexClassMatcher,
      this.sObjectMatcher
    )

    ParseTreeWalker.DEFAULT.walk(
      listener as ApexParserListener,
      tree as ParserRuleContext
    )

    return {
      methodTypeTable: listener.methodTypeTable,
      usedSObjectTypes: listener.usedSObjectTypes,
    }
  }
}
