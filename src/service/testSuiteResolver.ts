import { Messages } from '@salesforce/core'
import { ApexTestSuiteRepository } from '../adapter/apexTestSuiteRepository.js'
import { ApexMutationParameter } from '../type/ApexMutationParameter.js'
import { ConfigReader } from './configReader.js'

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

    return {
      ...parameter,
      apexTestClassNames: ConfigReader.normalizeClassPerimeter(
        [
          ...parameter.apexTestClassNames,
          // Grouping by requested suite keeps the perimeter in the order the
          // user named the suites. The adapter already returns each suite's
          // members ordered by class name, and filtering preserves that.
          ...suiteNames.flatMap(suiteName =>
            members
              .filter(member => member.suiteName === suiteName)
              .map(member => member.className)
          ),
        ],
        this.messages
      ),
    }
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
