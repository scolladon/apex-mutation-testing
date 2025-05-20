import { ParserRuleContext } from 'antlr4ts'
import { ApexParserListener } from 'apex-parser'
import { ApexMethod, ApexType } from '../type/ApexMethod.js'
export class MethodTypeListener implements ApexParserListener {
  private _methodTypeTable: Map<string, ApexMethod> = new Map()

  constructor(
    private _apexClassTypes: Set<string>,
    private _standardEntityTypes: Set<string>,
    private _customObjectTypes: Set<string>
  ) {}

  public getMethodTypeTable(): Map<string, ApexMethod> {
    return this._methodTypeTable
  }

  enterMethodDeclaration(ctx: ParserRuleContext): void {
    if (ctx.children && ctx.children.length >= 4) {
      const returnType = ctx.children[0].text
      const methodName = ctx.children[1].text

      if (returnType && methodName) {
        const lowerReturnType = returnType.toLowerCase()
        let elementType: string | undefined

        if (
          lowerReturnType.startsWith('list<') ||
          lowerReturnType.startsWith('set<')
        ) {
          const match = returnType.match(/<(.+)>/)
          if (match && match[1]) {
            elementType = match[1]
          }
        } else if (lowerReturnType.startsWith('map<')) {
          const match = returnType.match(/<(.+),(.+)>/)
          if (match && match[1] && match[2]) {
            elementType = `${match[1]},${match[2]}`
          }
        } else if (returnType.endsWith('[]')) {
          elementType = returnType.substring(0, returnType.length - 2)
        }

        let type: ApexType = ApexType.VOID

        if (lowerReturnType === 'void') {
          type = ApexType.VOID
        } else if (lowerReturnType === 'boolean') {
          type = ApexType.BOOLEAN
        } else if (lowerReturnType === 'integer') {
          type = ApexType.INTEGER
        } else if (lowerReturnType === 'long') {
          type = ApexType.LONG
        } else if (lowerReturnType === 'double') {
          type = ApexType.DOUBLE
        } else if (lowerReturnType === 'decimal') {
          type = ApexType.DECIMAL
        } else if (lowerReturnType === 'string') {
          type = ApexType.STRING
        } else if (lowerReturnType === 'id') {
          type = ApexType.ID
        } else if (lowerReturnType === 'blob') {
          type = ApexType.BLOB
        } else if (lowerReturnType === 'date') {
          type = ApexType.DATE
        } else if (lowerReturnType === 'datetime') {
          type = ApexType.DATETIME
        } else if (lowerReturnType === 'time') {
          type = ApexType.TIME
        } else if (lowerReturnType === 'sobject') {
          type = ApexType.SOBJECT
        } else if (lowerReturnType === 'object') {
          type = ApexType.OBJECT
        } else if (
          lowerReturnType.startsWith('list<') ||
          returnType.endsWith('[]')
        ) {
          type = ApexType.LIST
        } else if (lowerReturnType.startsWith('set<')) {
          type = ApexType.SET
        } else if (lowerReturnType.startsWith('map<')) {
          type = ApexType.MAP
        } else if (this._apexClassTypes.has(returnType)) {
          type = ApexType.APEX_CLASS
        } else if (this._standardEntityTypes.has(returnType)) {
          type = ApexType.STANDARD_ENTITY
        } else if (this._customObjectTypes.has(returnType)) {
          type = ApexType.CUSTOM_OBJECT
        }

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
    }
  }
}
