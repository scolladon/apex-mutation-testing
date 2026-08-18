import type {
  ApexSourceProvider,
  ApexTestSuiteMember,
  TypeDependencies,
} from '../../port/apexSourceProvider.js'
import type { ApexClass } from '../../type/ApexClass.js'
import type { SkippedTestClass } from '../../type/SkippedTestClass.js'
import type { ApexClassIdentity } from './ApexClassIdentity.js'
import type { ApexClassRepository } from './apexClassRepository.js'
import type { ApexTestSuiteRepository } from './apexTestSuiteRepository.js'

// A namespace prefix of `null` or `''` both mean local: the org emits either
// depending on projection, so both must read as usable.
const isLocal = (identity: ApexClassIdentity): boolean =>
  !identity.NamespacePrefix

export class OrgApexSourceProvider implements ApexSourceProvider {
  constructor(
    private readonly repository: ApexClassRepository,
    private readonly suiteRepository: ApexTestSuiteRepository
  ) {}

  // Existence-only check: a minimal projection avoids the `*` field list
  // jsforce resolves for an unprojected find (a describe$ round-trip
  // pulling every ApexClass field, including Body and SymbolTable).
  // readClass re-reads the same class in full when mutation actually
  // starts, so that full read is deliberately left alone.
  public async classExists(name: string): Promise<boolean> {
    return Boolean(await this.repository.read(name, ['Id']))
  }

  public async readClass(name: string): Promise<ApexClass> {
    return (await this.repository.read(name)) as unknown as ApexClass
  }

  public async listDependencies(
    apexClass: ApexClass
  ): Promise<TypeDependencies> {
    const dependencies = await this.repository.getApexClassDependencies(
      apexClass.Id
    )

    const apexClasses = dependencies
      .filter(dep => dep.RefMetadataComponentType === 'ApexClass')
      .map(dep => dep.RefMetadataComponentName)

    const standardEntityTypes = dependencies
      .filter(dep => dep.RefMetadataComponentType === 'StandardEntity')
      .map(dep => dep.RefMetadataComponentName)

    const customObjectTypes = dependencies
      .filter(dep => dep.RefMetadataComponentType === 'CustomObject')
      .map(dep => dep.RefMetadataComponentName)

    return {
      apexClasses,
      sObjects: [...standardEntityTypes, ...customObjectTypes],
    }
  }

  /** A name can return two rows when a managed and a local class share it,
   *  and any local row makes the entry usable. Every join is case-folded —
   *  `ApexClass.Name` matches case-insensitively on the org — while the
   *  reported className keeps the perimeter entry's own spelling. */
  public async assessPerimeter(
    apexTestClassNames: string[]
  ): Promise<SkippedTestClass[]> {
    const identities = await this.repository.readIdentities(apexTestClassNames)
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

  public async readTestSuiteMembers(
    suiteNames: string[]
  ): Promise<ApexTestSuiteMember[]> {
    return this.suiteRepository.readMembers(suiteNames)
  }

  public async readExistingTestSuiteNames(
    suiteNames: string[]
  ): Promise<string[]> {
    return this.suiteRepository.readExistingSuiteNames(suiteNames)
  }
}
