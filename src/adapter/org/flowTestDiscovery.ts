import { Connection } from '@salesforce/core'

interface DiscoveredTestClass {
  name: string
  testMethods?: { name: string }[]
}

interface DiscoveryPage {
  apexTestClasses?: DiscoveredTestClass[]
  nextRecordsUrl?: string | null
}

// Lists the FlowTests of one flow by name, through the Tooling API Test
// Discovery resource (API 66.0+) — names only, so no FlowTest of another
// flow is ever retrieved. The resource reports each flow as a test class
// named after the flow's API name, and each FlowTest as one of its methods.
// The method name is the FlowTest's own DeveloperName — the fullName a
// retrieve and the test runner address it by — and is used as is. (The
// Tooling API guide describes it as "<flow>_<test>"; observed on a sandbox,
// the method name equals the FlowTest's DeveloperName verbatim, whatever it
// starts with, so nothing may be stripped from it.)
export class FlowTestDiscovery {
  constructor(private readonly connection: Connection) {}

  public async listTestNames(flowApiName: string): Promise<string[]> {
    const names: string[] = []
    let url: string | null | undefined =
      `/services/data/v${this.connection.getApiVersion()}/tooling/tests?category=flow`
    while (url) {
      const page: DiscoveryPage =
        await this.connection.tooling.request<DiscoveryPage>(url)
      // Stryker disable next-line ArrayDeclaration: an element put in place
      // of the empty list has no name equal to a Flow API name, so it is
      // skipped like any other flow's class.
      for (const testClass of page.apexTestClasses ?? []) {
        if (testClass.name !== flowApiName) continue
        for (const method of testClass.testMethods ?? []) {
          names.push(method.name)
        }
      }
      url = page.nextRecordsUrl
    }
    return names
  }
}
