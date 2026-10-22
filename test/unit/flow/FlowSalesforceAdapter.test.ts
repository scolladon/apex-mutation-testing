import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  TestLevel,
  type TestResult,
  type TestRunIdResult,
  type TestService,
} from '@salesforce/apex-node'
import type { Connection } from '@salesforce/core'
import { ComponentSet } from '@salesforce/source-deploy-retrieve'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type FlowDeployer,
  FlowSalesforceAdapter,
} from '../../../src/flow/adapters/FlowSalesforceAdapter.js'

describe('FlowSalesforceAdapter', () => {
  let tempDir: string
  let tempFlowFile: string
  let mockConnection: Connection

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-adapter-test-'))
    tempFlowFile = path.join(tempDir, 'TestFlow.flow-meta.xml')
    await fs.writeFile(tempFlowFile, '<Flow></Flow>', 'utf-8')

    mockConnection = {
      singleRecordQuery: vi.fn(),
      tooling: {
        sobject: vi.fn(),
      },
    } as unknown as Connection
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  describe('deployFlowXml and deployFiles', () => {
    it('returns success immediately when filePaths is empty', async () => {
      const adapter = new FlowSalesforceAdapter(mockConnection)
      const res = await adapter.deployFiles([])
      expect(res.success).toBe(true)
    })

    it('uses injected custom deployer when provided', async () => {
      const mockDeployer: FlowDeployer = {
        deploy: vi.fn().mockResolvedValue({ success: true }),
      }
      const adapter = new FlowSalesforceAdapter(
        mockConnection,
        undefined,
        mockDeployer
      )

      const res = await adapter.deployFiles(['file1.xml'])
      expect(res.success).toBe(true)
      expect(mockDeployer.deploy).toHaveBeenCalledWith(['file1.xml'])
    })

    it('deploys flow xml using ComponentSet and succeeds', async () => {
      const mockPollStatus = vi.fn().mockResolvedValue({
        response: { success: true },
      })
      const mockDeploy = vi.fn().mockResolvedValue({
        pollStatus: mockPollStatus,
      })
      vi.spyOn(ComponentSet, 'fromSource').mockReturnValue({
        deploy: mockDeploy,
      } as unknown as ComponentSet)

      const adapter = new FlowSalesforceAdapter(mockConnection)
      const res = await adapter.deployFlowXml(
        tempFlowFile,
        '<Flow><status>Active</status></Flow>'
      )

      expect(res.success).toBe(true)
      const onDisk = await fs.readFile(tempFlowFile, 'utf-8')
      expect(onDisk).toBe('<Flow><status>Active</status></Flow>')
    })

    it('handles deploy failure with failed file responses and problems', async () => {
      const mockPollStatus = vi.fn().mockResolvedValue({
        response: {
          success: false,
          errorMessage: 'Deployment failed from response',
        },
        getFileResponses: () => [
          { state: 'Failed', error: 'Invalid tag on line 3' },
          { state: 'Failed', error: 'Direct error on line 4' },
          { state: 'Success', error: '' },
        ],
      })
      const mockDeploy = vi.fn().mockResolvedValue({
        pollStatus: mockPollStatus,
      })
      vi.spyOn(ComponentSet, 'fromSource').mockReturnValue({
        deploy: mockDeploy,
      } as unknown as ComponentSet)

      const adapter = new FlowSalesforceAdapter(mockConnection)
      const res = await adapter.deployFiles(['invalid.xml'])

      expect(res.success).toBe(false)
      expect(res.errorMessage).toBe(
        'Invalid tag on line 3; Direct error on line 4'
      )
    })

    it('handles deploy failure when getFileResponses is absent and falls back to errorMessage or default', async () => {
      // 1. With response.errorMessage
      const mockPollStatus1 = vi.fn().mockResolvedValue({
        response: { success: false, errorMessage: 'Deploy error message' },
      })
      vi.spyOn(ComponentSet, 'fromSource').mockReturnValueOnce({
        deploy: vi.fn().mockResolvedValue({ pollStatus: mockPollStatus1 }),
      } as unknown as ComponentSet)

      const adapter1 = new FlowSalesforceAdapter(mockConnection)
      const res1 = await adapter1.deployFiles(['file1.xml'])
      expect(res1.success).toBe(false)
      expect(res1.errorMessage).toBe('Deploy error message')

      // 2. Without response.errorMessage (default fallback)
      const mockPollStatus2 = vi.fn().mockResolvedValue({
        response: { success: false },
      })
      vi.spyOn(ComponentSet, 'fromSource').mockReturnValueOnce({
        deploy: vi.fn().mockResolvedValue({ pollStatus: mockPollStatus2 }),
      } as unknown as ComponentSet)

      const adapter2 = new FlowSalesforceAdapter(mockConnection)
      const res2 = await adapter2.deployFiles(['file2.xml'])
      expect(res2.success).toBe(false)
      expect(res2.errorMessage).toBe('Deployment failed')
    })

    it('handles exceptions thrown during componentSet deployment', async () => {
      // Error instance
      vi.spyOn(ComponentSet, 'fromSource').mockImplementationOnce(() => {
        throw new Error('ComponentSet creation failed')
      })

      const adapter1 = new FlowSalesforceAdapter(mockConnection)
      const res1 = await adapter1.deployFiles(['file1.xml'])
      expect(res1.success).toBe(false)
      expect(res1.errorMessage).toBe('ComponentSet creation failed')

      // Non-Error exception
      vi.spyOn(ComponentSet, 'fromSource').mockImplementationOnce(() => {
        throw 'String error thrown'
      })

      const adapter2 = new FlowSalesforceAdapter(mockConnection)
      const res2 = await adapter2.deployFiles(['file2.xml'])
      expect(res2.success).toBe(false)
      expect(res2.errorMessage).toBe('String error thrown')
    })
  })

  describe('getLatestFlowVersion', () => {
    it('throws error when flowApiName contains invalid characters', async () => {
      const adapter = new FlowSalesforceAdapter(mockConnection)
      await expect(
        adapter.getLatestFlowVersion("Account_Flow'; DROP TABLE--")
      ).rejects.toThrow('Invalid Flow API name')
    })

    it('returns versionNumber and flowId when found', async () => {
      mockConnection.singleRecordQuery = vi.fn().mockResolvedValue({
        VersionNumber: 4,
        LatestVersionId: '301d000000TEST',
      })

      const adapter = new FlowSalesforceAdapter(mockConnection)
      const res = await adapter.getLatestFlowVersion('Account_Flow')

      expect(res.versionNumber).toBe(4)
      expect(res.flowId).toBe('301d000000TEST')
      expect(mockConnection.singleRecordQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE ApiName = 'Account_Flow'"),
        { tooling: true }
      )
    })

    it('throws error when VersionNumber is undefined', async () => {
      mockConnection.singleRecordQuery = vi.fn().mockResolvedValue({})

      const adapter = new FlowSalesforceAdapter(mockConnection)
      await expect(
        adapter.getLatestFlowVersion('Account_Flow')
      ).rejects.toThrow("No FlowDefinitionView found for Flow 'Account_Flow'")
    })

    it('rethrows No FlowDefinitionView found error unchanged', async () => {
      mockConnection.singleRecordQuery = vi
        .fn()
        .mockRejectedValue(new Error('No FlowDefinitionView found for Flow'))

      const adapter = new FlowSalesforceAdapter(mockConnection)
      await expect(
        adapter.getLatestFlowVersion('Account_Flow')
      ).rejects.toThrow('No FlowDefinitionView found for Flow')
    })

    it('wraps query error in descriptive Error instance', async () => {
      mockConnection.singleRecordQuery = vi
        .fn()
        .mockRejectedValue(new Error('SOQL syntax error'))

      const adapter = new FlowSalesforceAdapter(mockConnection)
      await expect(
        adapter.getLatestFlowVersion('Account_Flow')
      ).rejects.toThrow('SOQL syntax error')

      // Non-Error thrown
      mockConnection.singleRecordQuery = vi
        .fn()
        .mockRejectedValue('Raw query failure')

      const adapter2 = new FlowSalesforceAdapter(mockConnection)
      await expect(
        adapter2.getLatestFlowVersion('Account_Flow')
      ).rejects.toThrow("Failed to query FlowDefinitionView for 'Account_Flow'")
    })
  })

  describe('deleteFlowVersion', () => {
    it('deletes flow version record and returns true on success', async () => {
      const mockDelete = vi.fn().mockResolvedValue({ success: true })
      mockConnection.tooling.sobject = vi.fn().mockReturnValue({
        delete: mockDelete,
      })

      const adapter = new FlowSalesforceAdapter(mockConnection)
      const res = await adapter.deleteFlowVersion('301d000000ID')

      expect(res).toBe(true)
      expect(mockConnection.tooling.sobject).toHaveBeenCalledWith('Flow')
      expect(mockDelete).toHaveBeenCalledWith('301d000000ID')
    })

    it('returns false when delete throws', async () => {
      mockConnection.tooling.sobject = vi.fn().mockReturnValue({
        delete: vi.fn().mockRejectedValue(new Error('Cannot delete active')),
      })

      const adapter = new FlowSalesforceAdapter(mockConnection)
      const res = await adapter.deleteFlowVersion('301d000000ID')
      expect(res).toBe(false)
    })
  })

  describe('runApexTests', () => {
    it('returns error when testClasses is empty or undefined', async () => {
      const adapter = new FlowSalesforceAdapter(mockConnection)
      const res = await adapter.runApexTests([])
      expect(res.allPassed).toBe(false)
      expect(res.failingMethods).toEqual(['No Apex test classes specified'])
    })

    it('runs apex tests successfully when all pass', async () => {
      const mockTestService = {
        buildAsyncPayload: vi.fn().mockResolvedValue({}),
        runTestAsynchronous: vi.fn().mockResolvedValue({
          summary: { outcome: 'Passed', failing: 0 },
          tests: [
            {
              outcome: 'Pass',
              methodName: 'testOne',
              apexClass: { name: 'ClassA' },
            },
          ],
        } as unknown as TestResult),
      } as unknown as TestService

      const adapter = new FlowSalesforceAdapter(mockConnection, mockTestService)
      const res = await adapter.runApexTests(['ClassA'])

      expect(res.allPassed).toBe(true)
      expect(res.failingMethods).toEqual([])
      expect(mockTestService.buildAsyncPayload).toHaveBeenCalledWith(
        TestLevel.RunSpecifiedTests,
        undefined,
        'ClassA'
      )
    })

    it('detects failing apex test methods', async () => {
      const mockTestService = {
        buildAsyncPayload: vi.fn().mockResolvedValue({}),
        runTestAsynchronous: vi.fn().mockResolvedValue({
          summary: { outcome: 'Failed', failing: 1 },
          tests: [
            {
              outcome: 'Fail',
              methodName: 'testFail',
              apexClass: { name: 'ClassA' },
            },
          ],
        } as unknown as TestResult),
      } as unknown as TestService

      const adapter = new FlowSalesforceAdapter(mockConnection, mockTestService)
      const res = await adapter.runApexTests(['ClassA'])

      expect(res.allPassed).toBe(false)
      expect(res.failingMethods).toEqual(['ClassA.testFail'])
    })

    it('handles apex test failure without individual failing methods', async () => {
      const mockTestService = {
        buildAsyncPayload: vi.fn().mockResolvedValue({}),
        runTestAsynchronous: vi.fn().mockResolvedValue({
          summary: { outcome: 'Failed', failing: 1 },
          tests: [],
        } as unknown as TestResult),
      } as unknown as TestService

      const adapter = new FlowSalesforceAdapter(mockConnection, mockTestService)
      const res = await adapter.runApexTests(['ClassA'])

      expect(res.allPassed).toBe(false)
      expect(res.failingMethods).toEqual(['ApexTestFailed'])

      // When tests property is undefined
      const mockTestServiceNoTests = {
        buildAsyncPayload: vi.fn().mockResolvedValue({}),
        runTestAsynchronous: vi.fn().mockResolvedValue({
          summary: { outcome: 'Failed', failing: 1 },
        } as unknown as TestResult),
      } as unknown as TestService

      const adapter2 = new FlowSalesforceAdapter(
        mockConnection,
        mockTestServiceNoTests
      )
      const res2 = await adapter2.runApexTests(['ClassA'])
      expect(res2.allPassed).toBe(false)
      expect(res2.failingMethods).toEqual(['ApexTestFailed'])
    })

    it('handles async run returning result without summary', async () => {
      const mockTestService = {
        buildAsyncPayload: vi.fn().mockResolvedValue({}),
        runTestAsynchronous: vi.fn().mockResolvedValue({
          testRunId: '707123',
        } as unknown as TestRunIdResult),
      } as unknown as TestService

      const adapter = new FlowSalesforceAdapter(mockConnection, mockTestService)
      const res = await adapter.runApexTests(['ClassA'])

      expect(res.allPassed).toBe(false)
      expect(res.failingMethods).toEqual([
        'Apex test run did not return results',
      ])
    })

    it('handles error thrown during apex test execution', async () => {
      const mockTestService = {
        buildAsyncPayload: vi
          .fn()
          .mockRejectedValue(new Error('Connection timeout')),
      } as unknown as TestService

      const adapter1 = new FlowSalesforceAdapter(
        mockConnection,
        mockTestService
      )
      const res1 = await adapter1.runApexTests(['ClassA'])
      expect(res1.allPassed).toBe(false)
      expect(res1.failingMethods).toEqual(['Connection timeout'])

      const mockTestService2 = {
        buildAsyncPayload: vi.fn().mockRejectedValue('Unknown error'),
      } as unknown as TestService

      const adapter2 = new FlowSalesforceAdapter(
        mockConnection,
        mockTestService2
      )
      const res2 = await adapter2.runApexTests(['ClassA'])
      expect(res2.allPassed).toBe(false)
      expect(res2.failingMethods).toEqual(['Apex test execution failed'])
    })
  })

  describe('runFlowTests', () => {
    it('runs flow tests synchronously and returns success', async () => {
      const mockTestService = {
        buildSyncPayload: vi.fn().mockResolvedValue({}),
        runTestSynchronous: vi.fn().mockResolvedValue({
          summary: { outcome: 'Passed', failing: 0, testsRan: 1 },
          tests: [{ outcome: 'Pass', methodName: 'Test_1' }],
        } as unknown as TestResult),
      } as unknown as TestService

      const adapter = new FlowSalesforceAdapter(mockConnection, mockTestService)
      const res = await adapter.runFlowTests('Account_Flow')

      expect(res.allPassed).toBe(true)
      expect(res.failingMethods).toEqual([])
      expect(mockTestService.buildSyncPayload).toHaveBeenCalledWith(
        TestLevel.RunSpecifiedTests,
        undefined,
        'FlowTesting.Account_Flow',
        'flow'
      )
    })

    it('runs specific flow test names when provided', async () => {
      const mockTestService = {
        buildSyncPayload: vi.fn().mockResolvedValue({}),
        runTestSynchronous: vi.fn().mockResolvedValue({
          summary: { outcome: 'Passed', failing: 0, testsRan: 1 },
          tests: [{ outcome: 'Pass', methodName: 'Test_1' }],
        } as unknown as TestResult),
      } as unknown as TestService

      const adapter = new FlowSalesforceAdapter(mockConnection, mockTestService)
      const res = await adapter.runFlowTests('Account_Flow', [
        'Account_Flow.Test_1',
        'FlowTesting.Account_Flow.Test_2',
        'Test_3',
      ])

      expect(res.allPassed).toBe(true)
      expect(mockTestService.buildSyncPayload).toHaveBeenCalledWith(
        TestLevel.RunSpecifiedTests,
        'FlowTesting.Account_Flow.Test_1,FlowTesting.Account_Flow.Test_2,FlowTesting.Account_Flow.Test_3',
        undefined,
        'flow'
      )
    })

    it('preserves FlowTesting. prefix when flowName already has it', async () => {
      const mockTestService = {
        buildSyncPayload: vi.fn().mockResolvedValue({}),
        runTestSynchronous: vi.fn().mockResolvedValue({
          summary: { outcome: 'Passed', failing: 0, testsRan: 1 },
          tests: [{ outcome: 'Pass', methodName: 'Test_1' }],
        } as unknown as TestResult),
      } as unknown as TestService

      const adapter = new FlowSalesforceAdapter(mockConnection, mockTestService)
      const res = await adapter.runFlowTests('FlowTesting.Account_Flow')

      expect(res.allPassed).toBe(true)
      expect(mockTestService.buildSyncPayload).toHaveBeenCalledWith(
        TestLevel.RunSpecifiedTests,
        undefined,
        'FlowTesting.Account_Flow',
        'flow'
      )
    })

    it('fails with No FlowTests found when summary testsRan is 0', async () => {
      const mockTestService = {
        buildSyncPayload: vi.fn().mockResolvedValue({}),
        runTestSynchronous: vi.fn().mockResolvedValue({
          summary: { outcome: 'Passed', testsRan: 0 },
        } as unknown as TestResult),
      } as unknown as TestService

      const adapter = new FlowSalesforceAdapter(mockConnection, mockTestService)
      const res = await adapter.runFlowTests('Account_Flow')

      expect(res.allPassed).toBe(false)
      expect(res.failingMethods).toEqual(['No FlowTests found'])
    })

    it('detects failing flow tests with methodName or UnknownTest fallback', async () => {
      const mockTestService = {
        buildSyncPayload: vi.fn().mockResolvedValue({}),
        runTestSynchronous: vi.fn().mockResolvedValue({
          summary: { outcome: 'Failed', failing: 2, testsRan: 2 },
          tests: [
            { outcome: 'Fail', methodName: 'TestFail' },
            { outcome: 'Fail' },
          ],
        } as unknown as TestResult),
      } as unknown as TestService

      const adapter = new FlowSalesforceAdapter(mockConnection, mockTestService)
      const res = await adapter.runFlowTests('Account_Flow')

      expect(res.allPassed).toBe(false)
      expect(res.failingMethods).toEqual(['TestFail', 'UnknownTest'])
    })

    it('handles flow test failure when individual tests array has no failures', async () => {
      const mockTestService = {
        buildSyncPayload: vi.fn().mockResolvedValue({}),
        runTestSynchronous: vi.fn().mockResolvedValue({
          summary: { outcome: 'Failed', failing: 1, testsRan: 1 },
          tests: [],
        } as unknown as TestResult),
      } as unknown as TestService

      const adapter = new FlowSalesforceAdapter(mockConnection, mockTestService)
      const res = await adapter.runFlowTests('Account_Flow')

      expect(res.allPassed).toBe(false)
      expect(res.failingMethods).toEqual(['FlowTestFailed'])

      // When summary has no testsRan property (testsRan is undefined)
      const mockTestServiceNoRan = {
        buildSyncPayload: vi.fn().mockResolvedValue({}),
        runTestSynchronous: vi.fn().mockResolvedValue({
          summary: { outcome: 'Failed', failing: 1 },
        } as unknown as TestResult),
      } as unknown as TestService

      const adapter2 = new FlowSalesforceAdapter(
        mockConnection,
        mockTestServiceNoRan
      )
      const res2 = await adapter2.runFlowTests('Account_Flow')
      expect(res2.allPassed).toBe(false)
      expect(res2.failingMethods).toEqual(['No FlowTests found'])

      // When tests array is undefined
      const mockTestServiceNoTests = {
        buildSyncPayload: vi.fn().mockResolvedValue({}),
        runTestSynchronous: vi.fn().mockResolvedValue({
          summary: { outcome: 'Failed', failing: 1, testsRan: 1 },
        } as unknown as TestResult),
      } as unknown as TestService

      const adapter3 = new FlowSalesforceAdapter(
        mockConnection,
        mockTestServiceNoTests
      )
      const res3 = await adapter3.runFlowTests('Account_Flow')
      expect(res3.allPassed).toBe(false)
      expect(res3.failingMethods).toEqual(['FlowTestFailed'])
    })

    it('handles synchronous run returning result without summary', async () => {
      const mockTestService = {
        buildSyncPayload: vi.fn().mockResolvedValue({}),
        runTestSynchronous: vi.fn().mockResolvedValue({
          testRunId: '707123',
        } as unknown as TestRunIdResult),
      } as unknown as TestService

      const adapter = new FlowSalesforceAdapter(mockConnection, mockTestService)
      const res = await adapter.runFlowTests('Account_Flow')

      expect(res.allPassed).toBe(false)
      expect(res.failingMethods).toEqual(['Flow test execution failed'])
    })

    it('handles error thrown during flow test execution', async () => {
      const mockTestService = {
        buildSyncPayload: vi
          .fn()
          .mockRejectedValue(new Error('Network failure')),
      } as unknown as TestService

      const adapter1 = new FlowSalesforceAdapter(
        mockConnection,
        mockTestService
      )
      const res1 = await adapter1.runFlowTests('Account_Flow')
      expect(res1.allPassed).toBe(false)
      expect(res1.failingMethods).toEqual(['Network failure'])

      const mockTestService2 = {
        buildSyncPayload: vi.fn().mockRejectedValue('String rejection'),
      } as unknown as TestService

      const adapter2 = new FlowSalesforceAdapter(
        mockConnection,
        mockTestService2
      )
      const res2 = await adapter2.runFlowTests('Account_Flow')
      expect(res2.allPassed).toBe(false)
      expect(res2.failingMethods).toEqual(['Failed to execute flow test'])
    })
  })

  describe('retrieveFlow', () => {
    it('uses injected custom retriever when provided', async () => {
      const mockRetriever = {
        retrieve: vi.fn().mockResolvedValue('/custom/path/Flow.flow-meta.xml'),
      }
      const adapter = new FlowSalesforceAdapter(
        mockConnection,
        undefined,
        undefined,
        mockRetriever
      )
      const result = await adapter.retrieveFlow('TestFlow', tempDir)
      expect(result).toBe('/custom/path/Flow.flow-meta.xml')
      expect(mockRetriever.retrieve).toHaveBeenCalledWith('TestFlow', tempDir)
    })

    it('retrieves flow using ComponentSet successfully and returns filePath', async () => {
      const retrievedFilePath = path.join(tempDir, 'TestFlow.flow-meta.xml')
      const mockPollStatus = vi.fn().mockResolvedValue({
        response: { success: true },
        getFileResponses: () => [
          {
            type: 'Flow',
            fullName: 'TestFlow',
            filePath: retrievedFilePath,
          },
          {
            type: 'FlowTest',
            fullName: 'TestFlow.Test1',
            filePath: path.join(tempDir, 'TestFlow_Test.flowtest-meta.xml'),
          },
        ],
      })
      const mockRetrieve = vi.fn().mockResolvedValue({
        pollStatus: mockPollStatus,
      })
      vi.spyOn(ComponentSet.prototype, 'retrieve').mockImplementation(
        mockRetrieve
      )

      const adapter = new FlowSalesforceAdapter(mockConnection)
      const result = await adapter.retrieveFlow('TestFlow', tempDir)

      expect(result).toBe(retrievedFilePath)
    })

    it('throws error when retrieve pollStatus returns success: false with array of messages', async () => {
      const mockPollStatus = vi.fn().mockResolvedValue({
        response: {
          success: false,
          messages: [
            { fileName: 'package.xml', problem: 'Entity not found' },
            { fileName: 'flow.xml', problem: 'Access denied' },
          ],
        },
      })
      vi.spyOn(ComponentSet.prototype, 'retrieve').mockResolvedValue({
        pollStatus: mockPollStatus,
      } as never)

      const adapter = new FlowSalesforceAdapter(mockConnection)
      await expect(adapter.retrieveFlow('TestFlow', tempDir)).rejects.toThrow(
        'Entity not found; Access denied'
      )
    })

    it('throws error when retrieve pollStatus returns success: false with single message or default', async () => {
      const mockPollStatus1 = vi.fn().mockResolvedValue({
        response: {
          success: false,
          messages: { fileName: 'flow.xml', problem: 'Single problem' },
        },
      })
      vi.spyOn(ComponentSet.prototype, 'retrieve').mockResolvedValue({
        pollStatus: mockPollStatus1,
      } as never)

      const adapter1 = new FlowSalesforceAdapter(mockConnection)
      await expect(adapter1.retrieveFlow('TestFlow', tempDir)).rejects.toThrow(
        'Single problem'
      )

      const mockPollStatus2 = vi.fn().mockResolvedValue({
        response: {
          success: false,
        },
      })
      vi.spyOn(ComponentSet.prototype, 'retrieve').mockResolvedValue({
        pollStatus: mockPollStatus2,
      } as never)

      const adapter2 = new FlowSalesforceAdapter(mockConnection)
      await expect(adapter2.retrieveFlow('TestFlow', tempDir)).rejects.toThrow(
        'Failed to retrieve Flow "TestFlow" from org.'
      )
    })

    it('throws error when retrieve succeeds but no flow file response is present', async () => {
      const mockPollStatus = vi.fn().mockResolvedValue({
        response: { success: true },
        getFileResponses: () => [
          {
            type: 'ApexClass',
            fullName: 'SomeClass',
            filePath: '/path/SomeClass.cls',
          },
        ],
      })
      vi.spyOn(ComponentSet.prototype, 'retrieve').mockResolvedValue({
        pollStatus: mockPollStatus,
      } as never)

      const adapter = new FlowSalesforceAdapter(mockConnection)
      await expect(adapter.retrieveFlow('TestFlow', tempDir)).rejects.toThrow(
        'Flow "TestFlow" was not found in retrieved metadata from org.'
      )
    })
  })
})
