export interface TypeMatcher {
  matches(typeName: string): boolean
}

export class ApexClassTypeMatcher implements TypeMatcher {
  constructor(private apexClassTypes: Set<string>) {}
  matches(typeName: string): boolean {
    return this.apexClassTypes.has(typeName)
  }
}

export class SObjectTypeMatcher implements TypeMatcher {
  constructor(private sObjectTypes: Set<string>) {}
  matches(typeName: string): boolean {
    return this.sObjectTypes.has(typeName)
  }
}
