import { ApexParserListener } from 'apex-parser'
import { ApexMutation } from '../type/ApexMutation.js'

// @ts-ignore: Base type with just a common _mutations property
export class BaseListener implements ApexParserListener {
  _mutations: ApexMutation[] = []
}
