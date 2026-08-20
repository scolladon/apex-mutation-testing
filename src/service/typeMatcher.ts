import type { TypeName } from '../port/apexSourceProvider.js'
import type { SObjectSchemaProvider } from '../port/sObjectSchemaProvider.js'
import { ApexType } from '../type/ApexMethod.js'

export interface TypeMatcher {
  matches(typeName: string): boolean
  collect(typeName: string): void
  readonly collectedTypes: ReadonlySet<string>
  populate?(): Promise<void>
  getFieldType?(objectType: string, fieldName: string): ApexType | undefined
}

export class AliasTypeMatcher implements TypeMatcher {
  // lower(alias) -> apiName; a real apiName NEVER loses to another type's alias.
  private readonly canonicalByAlias = new Map<string, string>()
  private readonly _collectedTypes: Set<string> = new Set()

  constructor(
    types: TypeName[],
    private readonly schema?: SObjectSchemaProvider
  ) {
    // Two passes: every canonical name first, then aliases only for keys
    // not already taken — a real apiName can never lose to another type's alias.
    this.registerCanonicalNames(types)
    this.registerAliases(types)
  }

  matches(typeName: string): boolean {
    return this.canonicalByAlias.has(typeName.toLowerCase())
  }

  collect(typeName: string): void {
    // Stores the canonical apiName, not the caller's spelling: this set is the
    // exact array handed to describe(), and case variants must dedupe.
    const canonical = this.canonical(typeName)
    if (canonical !== undefined) {
      this._collectedTypes.add(canonical)
    }
  }

  get collectedTypes(): ReadonlySet<string> {
    return this._collectedTypes
  }

  async populate(): Promise<void> {
    await this.schema?.describe([...this._collectedTypes])
  }

  getFieldType(objectType: string, fieldName: string): ApexType | undefined {
    return this.schema?.resolveFieldType(
      this.canonical(objectType) ?? objectType,
      fieldName
    )
  }

  private registerCanonicalNames(types: TypeName[]): void {
    for (const { apiName } of types) {
      this.canonicalByAlias.set(apiName.toLowerCase(), apiName)
    }
  }

  private registerAliases(types: TypeName[]): void {
    for (const { apiName, aliases } of types) {
      for (const alias of aliases) {
        const key = alias.toLowerCase()
        if (!this.canonicalByAlias.has(key)) {
          this.canonicalByAlias.set(key, apiName)
        }
      }
    }
  }

  private canonical(typeName: string): string | undefined {
    return this.canonicalByAlias.get(typeName.toLowerCase())
  }
}
