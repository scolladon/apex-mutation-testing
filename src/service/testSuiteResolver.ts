import { Messages } from '@salesforce/core'
import {
  ApexTestSuiteMember,
  ApexTestSuiteRepository,
} from '../adapter/apexTestSuiteRepository.js'
import { ApexMutationParameter } from '../type/ApexMutationParameter.js'
import { ConfigReader } from './configReader.js'

const membersOf = (
  members: ApexTestSuiteMember[],
  suiteName: string
): string[] =>
  members
    .filter(member => member.suiteName === suiteName)
    .map(member => member.className)

const appendOrigin = (
  origins: Map<string, string[]>,
  cliKeys: Set<string>,
  className: string,
  suiteName: string
): void => {
  const key = className.toLowerCase()
  if (cliKeys.has(key)) return
  origins.set(key, [...(origins.get(key) ?? []), suiteName])
}

export class TestSuiteResolver {
  constructor(
    private readonly repository: ApexTestSuiteRepository,
    private readonly messages: Messages<string>
  ) {}

  public async resolve(
    parameter: ApexMutationParameter
  ): Promise<ApexMutationParameter> {
    const suiteNames = parameter.apexTestSuiteNames ?? []
    if (suiteNames.length === 0) {
      return parameter
    }

    const members = await this.repository.readMembers(suiteNames)
    const resolvedSuiteNames = new Set(members.map(member => member.suiteName))
    const unresolved = suiteNames.filter(name => !resolvedSuiteNames.has(name))
    if (unresolved.length > 0) {
      await this.failOnUnresolvedSuites(unresolved)
    }

    const { memberNames, origins } = this.expandSuites(
      suiteNames,
      members,
      parameter.apexTestClassNames
    )
    return {
      ...parameter,
      apexTestClassNames: ConfigReader.normalizeClassPerimeter(
        [...parameter.apexTestClassNames, ...memberNames],
        this.messages
      ),
      testClassOrigins: origins,
    }
  }

  private expandSuites(
    suiteNames: string[],
    members: ApexTestSuiteMember[],
    cliClassNames: string[]
  ): { memberNames: string[]; origins: Map<string, string[]> } {
    const cliKeys = new Set(cliClassNames.map(name => name.toLowerCase()))
    const origins = new Map<string, string[]>()
    // Grouping by requested suite keeps the perimeter in the order the user
    // named the suites. The adapter already returns each suite's members
    // ordered by class name, and filtering preserves that.
    const memberNames = suiteNames.flatMap(suiteName => {
      const classNames = membersOf(members, suiteName)
      for (const className of classNames) {
        appendOrigin(origins, cliKeys, className, suiteName)
      }
      return classNames
    })
    return { memberNames, origins }
  }

  private async failOnUnresolvedSuites(suiteNames: string[]): Promise<never> {
    const existing = new Set(
      await this.repository.readExistingSuiteNames(suiteNames)
    )
    const errors = suiteNames.map(name =>
      existing.has(name)
        ? this.messages.getMessage('error.testSuiteEmpty', [name])
        : this.messages.getMessage('error.testSuiteNotFound', [name])
    )
    throw new Error(errors.join('\n'))
  }
}
