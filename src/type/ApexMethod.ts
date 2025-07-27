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
  STANDARD_ENTITY = 'STANDARD_ENTITY',
  CUSTOM_OBJECT = 'CUSTOM_OBJECT',
  OBJECT = 'OBJECT',
  APEX_CLASS = 'APEX_CLASS', //includes Interfaces & Enums
}

export interface ApexMethod {
  returnType: string
  startLine: number
  endLine: number

  type: ApexType

  elementType?: string
}
