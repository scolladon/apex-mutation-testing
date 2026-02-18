import type { TypeMatcher } from '../service/typeMatcher.js'
import type { ApexMethod, ApexType } from './ApexMethod.js'
import { APEX_TYPE } from './ApexMethod.js'

export interface ResolvedType {
  apexType: ApexType
  typeName: string
  elementType?: string
}

const PRIMITIVE_TYPE_MAP: ReadonlyMap<string, ApexType> = new Map([
  ['void', APEX_TYPE.VOID],
  ['boolean', APEX_TYPE.BOOLEAN],
  ['integer', APEX_TYPE.INTEGER],
  ['long', APEX_TYPE.LONG],
  ['double', APEX_TYPE.DOUBLE],
  ['decimal', APEX_TYPE.DECIMAL],
  ['string', APEX_TYPE.STRING],
  ['id', APEX_TYPE.ID],
  ['blob', APEX_TYPE.BLOB],
  ['date', APEX_TYPE.DATE],
  ['datetime', APEX_TYPE.DATETIME],
  ['time', APEX_TYPE.TIME],
  ['sobject', APEX_TYPE.SOBJECT],
  ['object', APEX_TYPE.OBJECT],
])

const APEX_TYPE_TO_NAME: ReadonlyMap<ApexType, string> = new Map([
  [APEX_TYPE.VOID, 'void'],
  [APEX_TYPE.BOOLEAN, 'Boolean'],
  [APEX_TYPE.INTEGER, 'Integer'],
  [APEX_TYPE.LONG, 'Long'],
  [APEX_TYPE.DOUBLE, 'Double'],
  [APEX_TYPE.DECIMAL, 'Decimal'],
  [APEX_TYPE.STRING, 'String'],
  [APEX_TYPE.ID, 'ID'],
  [APEX_TYPE.BLOB, 'Blob'],
  [APEX_TYPE.DATE, 'Date'],
  [APEX_TYPE.DATETIME, 'DateTime'],
  [APEX_TYPE.TIME, 'Time'],
  [APEX_TYPE.SOBJECT, 'SObject'],
  [APEX_TYPE.OBJECT, 'Object'],
  [APEX_TYPE.LIST, 'List'],
  [APEX_TYPE.SET, 'Set'],
  [APEX_TYPE.MAP, 'Map'],
  [APEX_TYPE.APEX_CLASS, 'Object'],
])

export function classifyApexType(
  typeName: string,
  matchers: TypeMatcher[]
): ApexType {
  const lowerType = typeName.toLowerCase()

  const primitiveType = PRIMITIVE_TYPE_MAP.get(lowerType)
  if (primitiveType !== undefined) {
    return primitiveType
  }

  if (lowerType.startsWith('list<') || typeName.endsWith('[]')) {
    return APEX_TYPE.LIST
  }
  if (lowerType.startsWith('set<')) {
    return APEX_TYPE.SET
  }
  if (lowerType.startsWith('map<')) {
    return APEX_TYPE.MAP
  }

  for (const matcher of matchers) {
    if (matcher.matches(typeName)) {
      return APEX_TYPE.OBJECT
    }
  }

  return APEX_TYPE.VOID
}

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
    return classifyApexType(typeName, this.matchers)
  }
}
