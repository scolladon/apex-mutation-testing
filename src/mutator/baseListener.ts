import { ApexParserListener } from 'apex-parser'

// @ts-ignore: Base type with just a common _mutations property
export class BaseListener implements ApexParserListener {
  _mutations: any[] = []
}
