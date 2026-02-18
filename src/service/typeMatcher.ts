import { SObjectDescribeRepository } from '../adapter/sObjectDescribeRepository.js'
import { ApexType } from '../type/ApexMethod.js'

export interface TypeMatcher {
  matches(typeName: string): boolean
  collect(typeName: string): void
  readonly collectedTypes: ReadonlySet<string>
  populate?(): Promise<void>
  getFieldType?(objectType: string, fieldName: string): ApexType | undefined
}

export class ApexClassTypeMatcher implements TypeMatcher {
  private readonly _collectedTypes: Set<string> = new Set()

  constructor(private apexClassTypes: Set<string>) {}

  matches(typeName: string): boolean {
    return this.apexClassTypes.has(typeName)
  }

  collect(typeName: string): void {
    if (this.matches(typeName)) {
      this._collectedTypes.add(typeName)
    }
  }

  get collectedTypes(): ReadonlySet<string> {
    return this._collectedTypes
  }
}

export class SObjectTypeMatcher implements TypeMatcher {
  private readonly _collectedTypes: Set<string> = new Set()

  constructor(
    private sObjectTypes: Set<string>,
    private readonly describeRepository?: SObjectDescribeRepository
  ) {}

  matches(typeName: string): boolean {
    return this.sObjectTypes.has(typeName)
  }

  collect(typeName: string): void {
    if (this.matches(typeName)) {
      this._collectedTypes.add(typeName)
    }
  }

  get collectedTypes(): ReadonlySet<string> {
    return this._collectedTypes
  }

  async populate(): Promise<void> {
    await this.describeRepository?.describe([...this._collectedTypes])
  }

  getFieldType(objectType: string, fieldName: string): ApexType | undefined {
    return this.describeRepository?.resolveFieldType(objectType, fieldName)
  }
}
