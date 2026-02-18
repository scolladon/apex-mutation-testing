export const APEX_TYPE = {
  VOID: 'VOID',
  BOOLEAN: 'BOOLEAN',
  INTEGER: 'INTEGER',
  LONG: 'LONG',
  DOUBLE: 'DOUBLE',
  DATE: 'DATE',
  DATETIME: 'DATETIME',
  TIME: 'TIME',
  DECIMAL: 'DECIMAL',
  STRING: 'STRING',
  ID: 'ID',
  BLOB: 'BLOB',
  LIST: 'LIST',
  SET: 'SET',
  MAP: 'MAP',
  SOBJECT: 'SOBJECT',
  OBJECT: 'OBJECT',
  APEX_CLASS: 'APEX_CLASS', //includes Interfaces & Enums
} as const

export type ApexType = (typeof APEX_TYPE)[keyof typeof APEX_TYPE]

export function getDefaultValueForApexType(
  apexType: ApexType,
  typeName?: string
): string | null {
  switch (apexType) {
    case APEX_TYPE.STRING:
    case APEX_TYPE.ID:
      return "''"
    case APEX_TYPE.INTEGER:
      return '0'
    case APEX_TYPE.LONG:
      return '0L'
    case APEX_TYPE.DOUBLE:
    case APEX_TYPE.DECIMAL:
      return '0.0'
    case APEX_TYPE.BOOLEAN:
      return 'false'
    case APEX_TYPE.BLOB:
      return "Blob.valueOf('')"
    case APEX_TYPE.LIST:
    case APEX_TYPE.SET:
    case APEX_TYPE.MAP:
    case APEX_TYPE.SOBJECT:
      return typeName ? `new ${typeName}()` : null
    default:
      return null
  }
}

export type SObjectFieldTypes = Map<string, Map<string, ApexType>>

export interface ApexMethod {
  returnType: string
  startLine: number
  endLine: number

  type: ApexType

  elementType?: string
}
