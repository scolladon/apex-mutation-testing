import { Connection } from '@salesforce/core'
import { ApexClass } from '../type/ApexClass.js'
import { MetadataComponentDependency } from '../type/MetadataComponentDependency.js'
export class ApexClassRepository {
  constructor(protected readonly connection: Connection) {}

  public async read(name: string) {
    return (
      await this.connection.tooling
        .sobject('ApexClass')
        .find({ Name: name })
        .execute()
    )[0]
  }

  public async getApexClassDependencies(
    classId: string
  ): Promise<MetadataComponentDependency[]> {
    return (await this.connection.tooling
      .sobject('MetadataComponentDependency')
      .find({ MetadataComponentId: classId })
      .execute()) as MetadataComponentDependency[]
  }

  public async update(apexClass: ApexClass) {
    const container = await this.connection.tooling
      .sobject('MetadataContainer')
      .create({
        Name: `MutationTest_${Date.now()}`,
      })

    // Create ApexClassMember for the mutated version
    await this.connection.tooling.sobject('ApexClassMember').create({
      MetadataContainerId: container.id,
      ContentEntityId: apexClass.Id,
      Body: apexClass.Body,
    })

    // Create ContainerAsyncRequest to deploy
    const asyncRequest = await this.connection.tooling
      .sobject('ContainerAsyncRequest')
      .create({
        IsCheckOnly: false,
        MetadataContainerId: container.id,
        IsRunTests: true,
      })

    if (!asyncRequest.id) {
      throw new Error('ContainerAsyncRequest did not return an ID')
    }

    // Poll for deployment completion
    const result = await this.pollForCompletion(asyncRequest.id)

    if (result['State'] === 'Failed') {
      const messages = result['DeployDetails']?.['allComponentMessages']
      const formattedErrors = Array.isArray(messages)
        ? messages
            .map(
              m =>
                `[${m.fileName}:${m.lineNumber}:${m.columnNumber}] ${m.problem}`
            )
            .join('\n')
        : result['ErrorMsg'] || 'Unknown error'

      throw new Error(`Deployment failed:\n${formattedErrors}`)
    }

    return result
  }

  private async pollForCompletion(requestId: string) {
    const terminalStates = new Set(['Completed', 'Failed', 'Error', 'Aborted'])

    let result = await this.connection.tooling
      .sobject('ContainerAsyncRequest')
      .retrieve(requestId)

    while (!terminalStates.has(result['State'] as string)) {
      await this.delay(100)
      result = await this.connection.tooling
        .sobject('ContainerAsyncRequest')
        .retrieve(requestId)
    }

    return result
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
