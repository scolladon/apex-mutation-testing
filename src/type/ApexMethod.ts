export enum ApexType {
  VOID = 'VOID',
  BOOLEAN = 'BOOLEAN',
  INTEGER = 'INTEGER',
  LONG = 'LONG',
  DOUBLE = 'DOUBLE',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  TIME = 'TIME',
  DECIMAL = 'DECIMAL',
  STRING = 'STRING',
  ID = 'ID',
  BLOB = 'BLOB',
  LIST = 'LIST',
  SET = 'SET',
  MAP = 'MAP',
  SOBJECT = 'SOBJECT',
  OBJECT = 'OBJECT',
  APEX_CLASS = 'APEX_CLASS', //includes Interfaces & Enums
}

export function getDefaultValueForApexType(
  apexType: ApexType,
  typeName?: string
): string | null {
  switch (apexType) {
    case ApexType.STRING:
    case ApexType.ID:
      return "''"
    case ApexType.INTEGER:
      return '0'
    case ApexType.LONG:
      return '0L'
    case ApexType.DOUBLE:
    case ApexType.DECIMAL:
      return '0.0'
    case ApexType.BOOLEAN:
      return 'false'
    case ApexType.BLOB:
      return "Blob.valueOf('')"
    case ApexType.LIST:
    case ApexType.SET:
    case ApexType.MAP:
    case ApexType.SOBJECT:
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
