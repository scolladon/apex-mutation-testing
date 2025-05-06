import { ParserRuleContext } from 'antlr4ts'
import { ParseTreeWalker } from 'antlr4ts/tree/index.js'
import { ApexParserListener } from 'apex-parser'
import { MethodTypeListener } from '../mutator/methodTypeListener.js'
import { ApexMethod } from '../type/ApexMethod.js'

export class ApexTypeResolver {
  private apexClassTypes: Set<string> = new Set()
  private standardEntityTypes: Set<string> = new Set()
  private customObjectTypes: Set<string> = new Set()

  constructor(
    apexClassTypes: string[] = [],
    standardEntityTypes: string[] = [],
    customObjectTypes: string[] = []
  ) {
    this.apexClassTypes = new Set(apexClassTypes)
    this.standardEntityTypes = new Set(standardEntityTypes)
    this.customObjectTypes = new Set(customObjectTypes)
  }

  public analyzeMethodTypes(tree: ParserRuleContext): Map<string, ApexMethod> {
    const listener = new MethodTypeListener(
      this.apexClassTypes,
      this.standardEntityTypes,
      this.customObjectTypes
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)

    return listener.getMethodTypeTable()
  }
}
