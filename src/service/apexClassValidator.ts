import { Connection } from '@salesforce/core'
import { ApexClassRepository } from '../adapter/apexClassRepository.js'
import { ApexClassIdentity } from '../type/ApexClassIdentity.js'
import { ApexMutationParameter } from '../type/ApexMutationParameter.js'
import { SkippedTestClass } from '../type/SkippedTestClass.js'

export class ApexClassNotFoundError extends Error {
  constructor(public readonly className: string) {
    super(`Apex class '${className}' not found`)
    this.name = 'ApexClassNotFoundError'
  }
}

// A namespace prefix of `null` or `''` both mean local: the org emits either
// depending on projection, so both must read as usable.
const isLocal = (identity: ApexClassIdentity): boolean =>
  !identity.NamespacePrefix

export class ApexClassValidator {
  private readonly apexClassRepository: ApexClassRepository
  constructor(protected readonly connection: Connection) {
    this.apexClassRepository = new ApexClassRepository(this.connection)
  }

  public async validate({
    apexClassName,
  }: ApexMutationParameter): Promise<void> {
    // Existence-only check: a minimal projection avoids the `*` field list
    // jsforce resolves for an unprojected find (a describe$ round-trip
    // pulling every ApexClass field, including Body and SymbolTable).
    // fetchApexClass re-reads the same class in full when mutation actually
    // starts, so that full read is deliberately left alone.
    const apexClass = await this.apexClassRepository.read(apexClassName, ['Id'])
    if (!apexClass) {
      throw new ApexClassNotFoundError(apexClassName)
    }
  }

  /** A name can return two rows when a managed and a local class share it,
   *  and any local row makes the entry usable. Every join is case-folded —
   *  `ApexClass.Name` matches case-insensitively on the org — while the
   *  reported className keeps the perimeter entry's own spelling. */
  public async assessPerimeter(
    apexTestClassNames: string[]
  ): Promise<SkippedTestClass[]> {
    const identities =
      await this.apexClassRepository.readIdentities(apexTestClassNames)
    const lowerNames = (rows: ApexClassIdentity[]) =>
      new Set(rows.map(identity => identity.Name.toLowerCase()))
    const known = lowerNames(identities)
    const accessible = lowerNames(identities.filter(isLocal))
    return apexTestClassNames
      .filter(name => !accessible.has(name.toLowerCase()))
      .map(name => ({
        className: name,
        reason: known.has(name.toLowerCase())
          ? ('not-accessible' as const)
          : ('not-found' as const),
      }))
  }
}
