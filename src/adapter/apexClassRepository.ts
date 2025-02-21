import { Connection } from '@salesforce/core'
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

  public async update(apexClass: any) {
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
    return await this.connection.tooling
      .sobject('ContainerAsyncRequest')
      .create({
        IsCheckOnly: false,
        MetadataContainerId: container.id,
        IsRunTests: true,
      })
  }
}
