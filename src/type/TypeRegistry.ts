import type { TypeMatcher } from '../service/typeMatcher.js'
import type { ApexMethod } from './ApexMethod.js'
import { ApexType } from './ApexMethod.js'

export interface ResolvedType {
  apexType: ApexType
  typeName: string
  elementType?: string
}

const PRIMITIVE_TYPE_MAP: ReadonlyMap<string, ApexType> = new Map([
  ['void', ApexType.VOID],
  ['boolean', ApexType.BOOLEAN],
  ['integer', ApexType.INTEGER],
  ['long', ApexType.LONG],
  ['double', ApexType.DOUBLE],
  ['decimal', ApexType.DECIMAL],
  ['string', ApexType.STRING],
  ['id', ApexType.ID],
  ['blob', ApexType.BLOB],
  ['date', ApexType.DATE],
  ['datetime', ApexType.DATETIME],
  ['time', ApexType.TIME],
  ['sobject', ApexType.SOBJECT],
  ['object', ApexType.OBJECT],
])

const APEX_TYPE_TO_NAME: ReadonlyMap<ApexType, string> = new Map([
  [ApexType.VOID, 'void'],
  [ApexType.BOOLEAN, 'Boolean'],
  [ApexType.INTEGER, 'Integer'],
  [ApexType.LONG, 'Long'],
  [ApexType.DOUBLE, 'Double'],
  [ApexType.DECIMAL, 'Decimal'],
  [ApexType.STRING, 'String'],
  [ApexType.ID, 'ID'],
  [ApexType.BLOB, 'Blob'],
  [ApexType.DATE, 'Date'],
  [ApexType.DATETIME, 'DateTime'],
  [ApexType.TIME, 'Time'],
  [ApexType.SOBJECT, 'SObject'],
  [ApexType.OBJECT, 'Object'],
  [ApexType.LIST, 'List'],
  [ApexType.SET, 'Set'],
  [ApexType.MAP, 'Map'],
  [ApexType.APEX_CLASS, 'Object'],
])

export class TypeRegistry {
  constructor(
    private methodTypeTable: Map<string, ApexMethod>,
    private variableScopes: Map<string, Map<string, string>>,
    private classFields: Map<string, string>,
    private matchers: TypeMatcher[]
  ) {}

  resolveType(methodName: string, expression?: string): ResolvedType | null {
    if (expression === undefined) {
      return this.resolveMethodReturnType(methodName)
    }

    if (expression.includes('(')) {
      return this.resolveMethodCallExpression(expression)
    }

    if (expression.includes('.')) {
      return this.resolveDottedExpression(methodName, expression)
    }

    return this.resolveVariable(methodName, expression)
  }

  private resolveMethodReturnType(methodName: string): ResolvedType | null {
    const method = this.methodTypeTable.get(methodName)
    if (!method) {
      return null
    }
    const result: ResolvedType = {
      apexType: method.type,
      typeName: method.returnType,
    }
    if (method.elementType !== undefined) {
      result.elementType = method.elementType
    }
    return result
  }

  private resolveMethodCallExpression(expression: string): ResolvedType | null {
    const methodName = expression.substring(0, expression.indexOf('('))
    return this.resolveMethodReturnType(methodName)
  }

  private resolveDottedExpression(
    methodName: string,
    expression: string
  ): ResolvedType | null {
    const dotIndex = expression.indexOf('.')
    const rootVar = expression.substring(0, dotIndex)
    const fieldName = expression.substring(dotIndex + 1)

    const rootType = this.findVariableType(methodName, rootVar)
    if (!rootType) {
      return null
    }

    for (const matcher of this.matchers) {
      if (matcher.getFieldType) {
        const fieldType = matcher.getFieldType(rootType, fieldName)
        if (fieldType !== undefined) {
          return {
            apexType: fieldType,
            typeName: APEX_TYPE_TO_NAME.get(fieldType) ?? rootType,
          }
        }
      }
    }

    return null
  }

  private resolveVariable(
    methodName: string,
    expression: string
  ): ResolvedType | null {
    const typeName = this.findVariableType(methodName, expression)
    if (!typeName) {
      return null
    }
    return {
      apexType: this.classifyType(typeName),
      typeName,
    }
  }

  private findVariableType(
    methodName: string,
    varName: string
  ): string | undefined {
    const methodScope = this.variableScopes.get(methodName)
    const scopeType = methodScope?.get(varName)
    if (scopeType) {
      return scopeType
    }
    return this.classFields.get(varName)
  }

  private classifyType(typeName: string): ApexType {
    const lowerType = typeName.toLowerCase()

    const primitiveType = PRIMITIVE_TYPE_MAP.get(lowerType)
    if (primitiveType !== undefined) {
      return primitiveType
    }

    if (lowerType.startsWith('list<') || typeName.endsWith('[]')) {
      return ApexType.LIST
    }
    if (lowerType.startsWith('set<')) {
      return ApexType.SET
    }
    if (lowerType.startsWith('map<')) {
      return ApexType.MAP
    }

    for (const matcher of this.matchers) {
      if (matcher.matches(typeName)) {
        return ApexType.OBJECT
      }
    }

    return ApexType.VOID
  }
}
