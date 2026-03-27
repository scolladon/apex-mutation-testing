import { SObjectDescribeRepository } from '../adapter/sObjectDescribeRepository.js'
import { ApexType } from '../type/ApexMethod.js'

export interface TypeMatcher {
  matches(typeName: string): boolean
  collect(typeName: string): void
  readonly collectedTypes: ReadonlySet<string>
  populate?(): Promise<void>
  getFieldType?(objectType: string, fieldName: string): ApexType | undefined
}

abstract class BaseTypeMatcher implements TypeMatcher {
  protected readonly _collectedTypes: Set<string> = new Set()

  abstract matches(typeName: string): boolean

  collect(typeName: string): void {
    if (this.matches(typeName)) {
      this._collectedTypes.add(typeName)
    }
  }

  get collectedTypes(): ReadonlySet<string> {
    return this._collectedTypes
  }
}

export class ApexClassTypeMatcher extends BaseTypeMatcher {
  constructor(private apexClassTypes: Set<string>) {
    super()
  }

  matches(typeName: string): boolean {
    return this.apexClassTypes.has(typeName)
  }
}

export class SObjectTypeMatcher extends BaseTypeMatcher {
  constructor(
    private sObjectTypes: Set<string>,
    private readonly describeRepository?: SObjectDescribeRepository
  ) {
    super()
  }

  matches(typeName: string): boolean {
    return this.sObjectTypes.has(typeName)
  }

  async populate(): Promise<void> {
    await this.describeRepository?.describe([...this._collectedTypes])
  }

  getFieldType(objectType: string, fieldName: string): ApexType | undefined {
    return this.describeRepository?.resolveFieldType(objectType, fieldName)
  }
}
