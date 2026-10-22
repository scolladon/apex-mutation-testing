import * as fs from 'node:fs/promises'
import { TestLevel, TestService } from '@salesforce/apex-node'
import type { Connection } from '@salesforce/core'
import {
  ComponentSet,
  type FileResponseFailure,
} from '@salesforce/source-deploy-retrieve'
import type {
  FlowDeployResult,
  FlowSalesforcePort,
  FlowTestRunResult,
} from '../types.js'

export interface FlowDeployer {
  deploy(filePaths: string[]): Promise<FlowDeployResult>
}

export interface FlowRetriever {
  retrieve(flowName: string, outputDir: string): Promise<string>
}

export class FlowSalesforceAdapter implements FlowSalesforcePort {
  public constructor(
    private readonly connection: Connection,
    private readonly testService: TestService = new TestService(connection),
    private readonly deployer?: FlowDeployer,
    private readonly retriever?: FlowRetriever
  ) {}

  public async deployFlowXml(
    flowFilePath: string,
    xmlContent: string
  ): Promise<FlowDeployResult> {
    await fs.writeFile(flowFilePath, xmlContent, 'utf-8')
    return this.deployFiles([flowFilePath])
  }

  public async deployFiles(filePaths: string[]): Promise<FlowDeployResult> {
    if (!filePaths || filePaths.length === 0) {
      return { success: true }
    }

    if (this.deployer) {
      return this.deployer.deploy(filePaths)
    }

    try {
      const componentSet = ComponentSet.fromSource(filePaths)
      const deploy = await componentSet.deploy({
        usernameOrConnection: this.connection,
      })
      const result = await deploy.pollStatus()

      if (result.response.success) {
        return { success: true }
      }

      const failures = result.getFileResponses
        ? result
            .getFileResponses()
            .filter((f): f is FileResponseFailure => f.state === 'Failed')
        : []
      const failureMsg =
        failures.length > 0
          ? failures
              .map(f => f.error)
              .filter(Boolean)
              .join('; ')
          : result.response.errorMessage || 'Deployment failed'

      return {
        success: false,
        errorMessage: failureMsg,
      }
    } catch (err: unknown) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      }
    }
  }

  public async getLatestFlowVersion(
    flowApiName: string
  ): Promise<{ versionNumber: number; flowId?: string }> {
    if (!/^[A-Za-z0-9_]+$/.test(flowApiName)) {
      throw new Error(`Invalid Flow API name: "${flowApiName}"`)
    }

    try {
      const query = `SELECT Label, VersionNumber, ApiName, LatestVersionId FROM FlowDefinitionView WHERE ApiName = '${flowApiName}'`
      const result = await this.connection.singleRecordQuery<{
        VersionNumber?: number
        LatestVersionId?: string
      }>(query, { tooling: true })

      if (result.VersionNumber !== undefined) {
        return {
          versionNumber: Number(result.VersionNumber),
          flowId: result.LatestVersionId,
        }
      }

      throw new Error(`No FlowDefinitionView found for Flow '${flowApiName}'`)
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.message.includes('No FlowDefinitionView found')
      ) {
        throw err
      }
      throw new Error(
        err instanceof Error
          ? err.message
          : `Failed to query FlowDefinitionView for '${flowApiName}'`
      )
    }
  }

  public async deleteFlowVersion(flowId: string): Promise<boolean> {
    try {
      const result = await this.connection.tooling
        .sobject('Flow')
        .delete(flowId)
      return result.success === true
    } catch {
      return false
    }
  }

  public async runApexTests(testClasses: string[]): Promise<FlowTestRunResult> {
    if (!testClasses || testClasses.length === 0) {
      return {
        allPassed: false,
        failingMethods: ['No Apex test classes specified'],
      }
    }

    try {
      const payload = await this.testService.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        testClasses.join(',')
      )
      const result = await this.testService.runTestAsynchronous(payload, false)

      if ('summary' in result) {
        const testsRan = Number(result.summary.testsRan ?? 0)
        const tests = result.tests ?? []
        const failures = tests
          .filter(t => t.outcome !== 'Pass')
          .map(t => `${t.apexClass.name}.${t.methodName}`)

        const isPassed =
          result.summary.outcome === 'Passed' &&
          Number(result.summary.failing ?? 0) === 0 &&
          failures.length === 0

        return {
          allPassed: isPassed,
          failingMethods: isPassed
            ? []
            : failures.length > 0
              ? failures
              : ['ApexTestFailed'],
          testsRan,
        }
      }

      return {
        allPassed: false,
        failingMethods: ['Apex test run did not return results'],
      }
    } catch (err: unknown) {
      return {
        allPassed: false,
        failingMethods: [
          err instanceof Error ? err.message : 'Apex test execution failed',
        ],
      }
    }
  }

  public async runFlowTests(
    flowName: string,
    testNames?: string[]
  ): Promise<FlowTestRunResult> {
    try {
      const hasSpecificTests = Boolean(testNames && testNames.length > 0)
      const formattedTests = hasSpecificTests
        ? testNames!.map(t => {
            if (t.startsWith('FlowTesting.')) return t
            if (t.includes('.')) return `FlowTesting.${t}`
            return `FlowTesting.${flowName}.${t}`
          })
        : undefined
      const flowClassName = flowName.startsWith('FlowTesting.')
        ? flowName
        : `FlowTesting.${flowName}`

      const payload = {
        ...(await this.testService.buildSyncPayload(
          TestLevel.RunSpecifiedTests,
          formattedTests ? formattedTests.join(',') : undefined,
          formattedTests ? undefined : flowClassName,
          'flow'
        )),
        skipCodeCoverage: true,
      }

      const result = await this.testService.runTestSynchronous(payload, false)

      if ('summary' in result) {
        const testsRan = Number(result.summary.testsRan ?? 0)
        if (testsRan === 0) {
          return {
            allPassed: false,
            failingMethods: ['No FlowTests found'],
            testsRan: 0,
          }
        }

        const tests = result.tests ?? []
        const failures = tests
          .filter(t => t.outcome !== 'Pass')
          .map(t => t.methodName || 'UnknownTest')

        const isPassed =
          result.summary.outcome === 'Passed' &&
          Number(result.summary.failing ?? 0) === 0 &&
          failures.length === 0

        return {
          allPassed: isPassed,
          failingMethods: isPassed
            ? []
            : failures.length > 0
              ? failures
              : ['FlowTestFailed'],
          testsRan,
        }
      }

      return {
        allPassed: false,
        failingMethods: ['Flow test execution failed'],
      }
    } catch (err: unknown) {
      return {
        allPassed: false,
        failingMethods: [
          err instanceof Error ? err.message : 'Failed to execute flow test',
        ],
      }
    }
  }

  public async retrieveFlow(
    flowName: string,
    outputDir: string
  ): Promise<string> {
    if (this.retriever) {
      return this.retriever.retrieve(flowName, outputDir)
    }

    const cs = new ComponentSet([
      { type: 'Flow', fullName: flowName },
      { type: 'FlowTest', fullName: '*' },
    ])
    const retrieve = await cs.retrieve({
      usernameOrConnection: this.connection,
      output: outputDir,
    })
    const result = await retrieve.pollStatus()
    if (!result.response.success) {
      const rawMessages = result.response.messages
      const msgList = Array.isArray(rawMessages)
        ? rawMessages
        : rawMessages
          ? [rawMessages]
          : []
      const errorDetails = msgList
        .map(m => m.problem)
        .filter(Boolean)
        .join('; ')
      throw new Error(
        errorDetails || `Failed to retrieve Flow "${flowName}" from org.`
      )
    }
    const flowResponse = result
      .getFileResponses()
      .find(f => f.type === 'Flow' && f.filePath)
    if (!flowResponse?.filePath) {
      throw new Error(
        `Flow "${flowName}" was not found in retrieved metadata from org.`
      )
    }
    return flowResponse.filePath
  }
}
